import { db } from '../db/index.js';
import { generatePreVisitSummary } from './llmService.js';
import { emailService } from './emailService.js';

export const appointmentService = {
  // Get Doctor Available Slots for a given date
  getAvailableSlots: async (doctorId, dateStr) => {
    // 1. Fetch Doctor Config
    const doctor = await db.queryOne(
      `SELECT * FROM doctors WHERE id = $1 AND is_active = true`,
      [doctorId]
    );

    if (!doctor) {
      throw new Error('Doctor profile not found or inactive');
    }

    // 2. Check if Doctor is on Leave on requested date
    const leave = await db.queryOne(
      `SELECT * FROM leave_days WHERE doctor_id = $1 AND leave_date = $2`,
      [doctorId, dateStr]
    );

    if (leave) {
      return {
        isOnLeave: true,
        leaveReason: leave.reason || 'Doctor is on leave',
        slots: []
      };
    }

    // 3. Fetch Existing Booked Appointments
    const bookedAppointments = await db.query(
      `SELECT start_time, end_time FROM appointments WHERE doctor_id = $1 AND date = $2 AND status != 'cancelled'`,
      [doctorId, dateStr]
    );

    const bookedSet = new Set(bookedAppointments.map(a => a.start_time));

    // 4. Generate Time Slots
    const slots = [];
    const [startH, startM] = doctor.working_start.split(':').map(Number);
    const [endH, endM] = doctor.working_end.split(':').map(Number);
    const duration = doctor.slot_duration;

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const [breakStartH, breakStartM] = (doctor.break_start || '13:00').split(':').map(Number);
    const [breakEndH, breakEndM] = (doctor.break_end || '14:00').split(':').map(Number);
    const breakStartMins = breakStartH * 60 + breakStartM;
    const breakEndMins = breakEndH * 60 + breakEndM;

    while (currentMinutes + duration <= endMinutes) {
      const slotStartH = Math.floor(currentMinutes / 60);
      const slotStartM = currentMinutes % 60;
      const slotEndMins = currentMinutes + duration;
      const slotEndH = Math.floor(slotEndMins / 60);
      const slotEndM = slotEndMins % 60;

      const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const startTimeStr = formatTime(slotStartH, slotStartM);
      const endTimeStr = formatTime(slotEndH, slotEndM);

      // Check if slot falls in break time
      const isBreak = (currentMinutes >= breakStartMins && currentMinutes < breakEndMins);

      // Check if booked
      const isBooked = bookedSet.has(startTimeStr);

      slots.push({
        startTime: startTimeStr,
        endTime: endTimeStr,
        available: !isBreak && !isBooked,
        isBreak,
        isBooked
      });

      currentMinutes += duration;
    }

    return {
      isOnLeave: false,
      leaveReason: null,
      slots
    };
  },

  // Book Appointment with Concurrency Protection & Pre-Visit AI Summary
  bookAppointment: async ({ patientId, doctorId, date, startTime, symptoms, duration = '3 days', severity = 5, medicalHistory = '' }) => {
    // Fetch doctor config
    const doctor = await db.queryOne(
      `SELECT d.*, u.name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
      [doctorId]
    );

    if (!doctor) {
      throw new Error('Doctor profile not found');
    }

    // Fetch patient config
    const patient = await db.queryOne(
      `SELECT * FROM users WHERE id = $1 AND role = 'patient'`,
      [patientId]
    );

    if (!patient) {
      throw new Error('Patient record not found');
    }

    // Calculate End Time
    const [startH, startM] = startTime.split(':').map(Number);
    const totalEndMins = startH * 60 + startM + doctor.slot_duration;
    const endH = Math.floor(totalEndMins / 60);
    const endM = totalEndMins % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    // 1. Double-Booking Pre-Check
    const existing = await db.queryOne(
      `SELECT id FROM appointments WHERE doctor_id = $1 AND date = $2 AND start_time = $3 AND status != 'cancelled'`,
      [doctorId, date, startTime]
    );

    if (existing) {
      const err = new Error('CONCURRENCY_ERROR: Selected slot has already been booked by another patient.');
      err.statusCode = 409;
      throw err;
    }

    // 2. Check Doctor Leave
    const leave = await db.queryOne(
      `SELECT id FROM leave_days WHERE doctor_id = $1 AND leave_date = $2`,
      [doctorId, date]
    );

    if (leave) {
      const err = new Error('Doctor is on leave on the selected date.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Create Appointment Record (Enforces UNIQUE constraint at DB layer)
    const appointmentId = `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    try {
      await db.query(
        `INSERT INTO appointments (id, patient_id, doctor_id, date, start_time, end_time, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [appointmentId, patientId, doctorId, date, startTime, endTime, 'booked']
      );
    } catch (dbErr) {
      if (dbErr.message && (dbErr.message.includes('UNIQUE') || dbErr.message.includes('unique') || dbErr.message.includes('SQLITE_CONSTRAINT') || dbErr.message.includes('constraint failed'))) {
        const err = new Error('CONCURRENCY_ERROR: Selected slot has already been booked by another patient.');
        err.statusCode = 409;
        throw err;
      }
      throw dbErr;
    }

    // 4. Save Symptom Form
    const symptomId = `sym-${Date.now()}`;
    await db.query(
      `INSERT INTO symptom_forms (id, appointment_id, symptoms, duration, severity, medical_history) VALUES ($1, $2, $3, $4, $5, $6)`,
      [symptomId, appointmentId, symptoms, duration, severity, medicalHistory]
    );

    // 5. Generate Pre-Visit AI Summary (extended)
    const aiResult = await generatePreVisitSummary(symptoms, duration, severity);

    // Pack the extended fields into suggested_questions as rich JSON
    const extendedData = JSON.stringify({
      questions: aiResult.suggested_questions,
      symptom_cause: aiResult.symptom_cause,
      prevention_tips: aiResult.prevention_tips,
      initial_care: aiResult.initial_care,
      medicines_to_avoid: aiResult.medicines_to_avoid,
      red_flags: aiResult.red_flags,
      suggested_next_visit: aiResult.suggested_next_visit,
      provider: aiResult.provider
    });

    const preSummaryId = `pvs-${Date.now()}`;
    await db.query(
      `INSERT INTO pre_visit_summaries (id, appointment_id, urgency_level, chief_complaint, suggested_questions, raw_llm_output, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        preSummaryId,
        appointmentId,
        aiResult.urgency_level,
        aiResult.chief_complaint,
        extendedData,
        aiResult.raw_llm_output || '',
        aiResult.status
      ]
    );

    const appointmentObj = { id: appointmentId, patient_id: patientId, doctor_id: doctorId, date, start_time: startTime, end_time: endTime, status: 'booked' };

    // 6. Send Confirmation Email & Calendar URL
    await emailService.sendBookingConfirmation(appointmentObj, doctor, patient);

    return {
      appointment: appointmentObj,
      preVisitSummary: aiResult
    };
  }
};
