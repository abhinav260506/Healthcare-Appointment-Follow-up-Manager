import { db } from '../db/index.js';
import { emailService } from './emailService.js';

export const leaveService = {
  // Doctor submits a Leave Request (from_date to to_date)
  submitLeaveRequest: async (doctorId, fromDate, toDate, reason) => {
    const doctor = await db.queryOne(
      `SELECT d.*, u.name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1 OR d.user_id = $1`,
      [doctorId]
    );

    if (!doctor) {
      throw new Error('Doctor profile not found');
    }

    const reqId = `lr-${Date.now()}`;
    await db.query(
      `INSERT INTO leave_requests (id, doctor_id, from_date, to_date, reason, status) VALUES ($1, $2, $3, $4, $5, $6)`,
      [reqId, doctor.id, fromDate, toDate, reason, 'pending']
    );

    return {
      id: reqId,
      doctorId: doctor.id,
      doctorName: doctor.name,
      fromDate,
      toDate,
      reason,
      status: 'pending'
    };
  },

  // Get Leave Requests (All for Admin, or specific doctor)
  getLeaveRequests: async (doctorId = null) => {
    let sql = `
      SELECT lr.*, u.name as doctor_name, u.email as doctor_email, d.specialisation
      FROM leave_requests lr
      JOIN doctors d ON lr.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
    `;
    const params = [];

    if (doctorId) {
      params.push(doctorId);
      params.push(doctorId);
      sql += ` WHERE lr.doctor_id = $1 OR lr.doctor_id IN (SELECT id FROM doctors WHERE user_id = $2)`;
    }

    sql += ` ORDER BY lr.created_at DESC`;

    return await db.query(sql, params);
  },

  // Admin responds to Leave Request ('approved' | 'rejected')
  respondLeaveRequest: async (leaveRequestId, status, adminResponse = '') => {
    if (!['approved', 'rejected'].includes(status)) {
      throw new Error('Invalid status. Must be "approved" or "rejected".');
    }

    const request = await db.queryOne(`SELECT * FROM leave_requests WHERE id = $1`, [leaveRequestId]);
    if (!request) {
      throw new Error('Leave request record not found');
    }

    const doctor = await db.queryOne(
      `SELECT d.*, u.name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1 OR d.user_id = $1`,
      [request.doctor_id]
    );

    if (!doctor) {
      throw new Error('Doctor record associated with leave request not found');
    }

    // Update Request Status
    await db.query(
      `UPDATE leave_requests SET status = $1, admin_response = $2 WHERE id = $3`,
      [status, adminResponse, leaveRequestId]
    );

    const affectedPatientsNotified = [];

    // If Approved, apply leave_days for all dates in range & cancel affected bookings with notifications
    if (status === 'approved') {
      const dates = getDatesBetween(request.from_date, request.to_date);

      for (const d of dates) {
        // Insert into leave_days
        try {
          const lId = `leave-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          await db.query(
            `INSERT INTO leave_days (id, doctor_id, leave_date, reason) VALUES ($1, $2, $3, $4)`,
            [lId, doctor.id, d, request.reason]
          );
        } catch (err) {
          // Ignore duplicate leave day insert
        }

        // Find and cancel affected appointments on date d
        const affected = await db.query(
          `SELECT a.*, u.name as patient_name, u.email as patient_email 
           FROM appointments a 
           JOIN users u ON a.patient_id = u.id 
           WHERE (a.doctor_id = $1 OR a.doctor_id = $2) AND a.date = $3 AND a.status IN ('booked', 'rescheduled')`,
          [doctor.id, doctor.user_id, d]
        );

        for (const apt of affected) {
          await db.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [apt.id]);

          const patient = { name: apt.patient_name, email: apt.patient_email };
          await emailService.sendDoctorLeaveNotice(apt, doctor, patient, d, request.reason);

          affectedPatientsNotified.push({
            appointmentId: apt.id,
            patientName: apt.patient_name,
            patientEmail: apt.patient_email,
            date: d,
            time: apt.start_time
          });
        }
      }
    }

    return {
      leaveRequestId,
      status,
      affectedCount: affectedPatientsNotified.length,
      affectedPatients: affectedPatientsNotified
    };
  },

  // Add Single Day Leave (legacy direct call)
  addLeave: async (doctorId, leaveDate, reason = 'Doctor Leave') => {
    const req = await leaveService.submitLeaveRequest(doctorId, leaveDate, leaveDate, reason);
    return await leaveService.respondLeaveRequest(req.id, 'approved', 'Granted by Admin');
  },

  removeLeave: async (leaveId) => {
    await db.query(`DELETE FROM leave_days WHERE id = $1`, [leaveId]);
    return { success: true };
  }
};

function getDatesBetween(startDateStr, endDateStr) {
  const dates = [];
  let curr = new Date(startDateStr);
  const end = new Date(endDateStr);

  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}
