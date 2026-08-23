import express from 'express';
import { db } from '../db/index.js';
import { appointmentService } from '../services/appointmentService.js';
import { calendarService } from '../services/calendarService.js';
import { emailService } from '../services/emailService.js';
import { generatePreVisitSummary } from '../services/llmService.js';

const router = express.Router();

// Real-time Symptom & Severity AI Analysis Preview
router.post('/analyze-symptoms', async (req, res) => {
  try {
    const { symptoms, duration = '3 days', severity = 5 } = req.body;
    if (!symptoms) {
      return res.status(400).json({ error: 'Symptoms text is required' });
    }
    const analysis = await generatePreVisitSummary(symptoms, duration, severity);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Available Slots for Doctor on a specific date
router.get('/available-slots', async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({ error: 'doctorId and date query parameters are required' });
    }

    const slotsData = await appointmentService.getAvailableSlots(doctorId, date);
    res.json(slotsData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Book Appointment (Includes Symptom Form & Pre-Visit AI Summary)
router.post('/book', async (req, res) => {
  try {
    const { patientId, doctorId, date, startTime, symptoms, duration, severity, medicalHistory } = req.body;

    if (!patientId || !doctorId || !date || !startTime || !symptoms) {
      return res.status(400).json({ error: 'Missing required booking fields (patientId, doctorId, date, startTime, symptoms)' });
    }

    const bookingResult = await appointmentService.bookAppointment({
      patientId,
      doctorId,
      date,
      startTime,
      symptoms,
      duration,
      severity,
      medicalHistory
    });

    res.status(201).json(bookingResult);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// Get Patient Appointments Dashboard
router.get('/patient/:patientId', async (req, res) => {
  try {
    const appointments = await db.query(
      `SELECT a.*, 
              u.name as doctor_name, u.email as doctor_email, d.specialisation,
              pvs.urgency_level, pvs.chief_complaint, pvs.suggested_questions,
              pvsum.patient_friendly_summary, pvsum.medication_schedule, pvsum.follow_up_steps,
              sym.symptoms, sym.duration, sym.severity
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN symptom_forms sym ON a.id = sym.appointment_id
       LEFT JOIN pre_visit_summaries pvs ON a.id = pvs.appointment_id
       LEFT JOIN post_visit_summaries pvsum ON a.id = pvsum.appointment_id
       WHERE a.patient_id = $1 OR a.patient_id IN (SELECT id FROM users WHERE email = $2)
       ORDER BY a.created_at DESC, a.date DESC, a.start_time DESC`,
      [req.params.patientId, req.params.patientId]
    );

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Doctor Appointment Queue Agenda - sorted by severity (priority queue)
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const { date } = req.query;
    let sql = `
      SELECT a.*, 
             u.name as patient_name, u.email as patient_email, pat.phone, pat.date_of_birth, pat.medical_history,
             sym.symptoms, sym.duration, sym.severity,
             pvs.id as pre_summary_id, pvs.urgency_level, pvs.chief_complaint, pvs.suggested_questions,
             pvn.diagnosis, pvn.clinical_notes, pvn.vitals, pvn.prescriptions,
             pvsum.patient_friendly_summary
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN patients pat ON u.id = pat.user_id
      LEFT JOIN symptom_forms sym ON a.id = sym.appointment_id
      LEFT JOIN pre_visit_summaries pvs ON a.id = pvs.appointment_id
      LEFT JOIN post_visit_notes pvn ON a.id = pvn.appointment_id
      LEFT JOIN post_visit_summaries pvsum ON a.id = pvsum.appointment_id
      WHERE (a.doctor_id = $1 OR a.doctor_id IN (SELECT id FROM doctors WHERE user_id = $2 OR id = $3))
    `;
    const params = [req.params.doctorId, req.params.doctorId, req.params.doctorId];

    if (date) {
      params.push(date);
      sql += ` AND a.date = $4`;
    }

    // Priority queue: booked first, then by severity DESC (Critical/High first), then by time ASC
    sql += `
      ORDER BY
        CASE a.status WHEN 'booked' THEN 0 WHEN 'rescheduled' THEN 1 ELSE 2 END ASC,
        CASE pvs.urgency_level WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END ASC,
        COALESCE(sym.severity, 5) DESC,
        a.date ASC,
        a.start_time ASC
    `;

    const appointments = await db.query(sql, params);
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Full Patient History (past visits, clinical notes, prescriptions) for Doctor view
router.get('/patient-history/:patientId', async (req, res) => {
  try {
    const history = await db.query(
      `SELECT a.id, a.date, a.start_time, a.end_time, a.status,
              u.name as doctor_name, d.specialisation,
              sym.symptoms, sym.duration, sym.severity,
              pvs.urgency_level, pvs.chief_complaint, pvs.suggested_questions,
              pvn.diagnosis, pvn.clinical_notes, pvn.vitals, pvn.prescriptions,
              pvsum.patient_friendly_summary, pvsum.medication_schedule, pvsum.follow_up_steps
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN symptom_forms sym ON a.id = sym.appointment_id
       LEFT JOIN pre_visit_summaries pvs ON a.id = pvs.appointment_id
       LEFT JOIN post_visit_notes pvn ON a.id = pvn.appointment_id
       LEFT JOIN post_visit_summaries pvsum ON a.id = pvsum.appointment_id
       WHERE a.patient_id = $1 AND a.status = 'completed'
       ORDER BY a.date DESC, a.start_time DESC`,
      [req.params.patientId]
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Cancel Appointment
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason = 'Cancelled by patient' } = req.body;

    const appointment = await db.queryOne(`SELECT * FROM appointments WHERE id = $1`, [req.params.id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await db.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [req.params.id]);

    const doctor = await db.queryOne(
      `SELECT d.*, u.name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1 OR d.user_id = $1`,
      [appointment.doctor_id]
    );
    const patient = await db.queryOne(
      `SELECT * FROM users WHERE id = $1 OR id IN (SELECT user_id FROM patients WHERE id = $1)`,
      [appointment.patient_id]
    );

    if (doctor && patient) {
      await emailService.sendCancellationNotice(appointment, doctor, patient, reason);
    }

    res.json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download .ics iCalendar file for Appointment
router.get('/:id/calendar.ics', async (req, res) => {
  try {
    const appointment = await db.queryOne(`SELECT * FROM appointments WHERE id = $1`, [req.params.id]);
    if (!appointment) {
      return res.status(404).send('Appointment not found');
    }

    const doctor = await db.queryOne(`SELECT d.*, u.name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`, [appointment.doctor_id]);
    const patient = await db.queryOne(`SELECT * FROM users WHERE id = $1`, [appointment.patient_id]);

    const cs = await calendarService.generateIcs(appointment, doctor, patient);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointment.id}.ics"`);
    res.send(cs);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
