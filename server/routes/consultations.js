import express from 'express';
import { db } from '../db/index.js';
import { generatePostVisitSummary } from '../services/llmService.js';

const router = express.Router();

// Complete Visit Consultation (Doctor submits notes, diagnosis, vitals, prescriptions -> AI Post-Visit Summary & Medication Reminders)
router.post('/complete', async (req, res) => {
  try {
    const { appointmentId, clinicalNotes, diagnosis, vitals, prescriptions } = req.body;

    if (!appointmentId || !clinicalNotes || !diagnosis) {
      return res.status(400).json({ error: 'appointmentId, clinicalNotes, and diagnosis are required' });
    }

    const appointment = await db.queryOne(`SELECT * FROM appointments WHERE id = $1`, [appointmentId]);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // 1. Save Doctor Clinical Notes
    const noteId = `pvn-${Date.now()}`;
    await db.query(
      `INSERT INTO post_visit_notes (id, appointment_id, clinical_notes, diagnosis, vitals, prescriptions) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        noteId,
        appointmentId,
        clinicalNotes,
        diagnosis,
        JSON.stringify(vitals || {}),
        JSON.stringify(prescriptions || [])
      ]
    );

    // 2. Generate Patient-Friendly AI Post-Visit Summary
    const aiResult = await generatePostVisitSummary(clinicalNotes, diagnosis, vitals, prescriptions);

    const postSummaryId = `pvsum-${Date.now()}`;
    await db.query(
      `INSERT INTO post_visit_summaries (id, appointment_id, patient_friendly_summary, medication_schedule, follow_up_steps, raw_llm_output, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        postSummaryId,
        appointmentId,
        aiResult.patient_friendly_summary,
        JSON.stringify(aiResult.medication_schedule),
        JSON.stringify(aiResult.follow_up_steps),
        aiResult.raw_llm_output,
        aiResult.status
      ]
    );

    // 3. Mark Appointment Status as Completed
    await db.query(`UPDATE appointments SET status = 'completed' WHERE id = $1`, [appointmentId]);

    // 4. Auto-Build Medication Reminders Schedule
    const today = new Date().toISOString().split('T')[0];
    const parsedRx = Array.isArray(prescriptions) ? prescriptions : [];

    for (const rx of parsedRx) {
      const drugName = rx.drug || rx.medication_name || 'Prescribed Medication';
      const dosage = rx.dosage || '1 dose';
      const frequency = rx.frequency || 'Daily';

      // Schedule morning dose
      const remId1 = `rem-${Date.now()}-am-${Math.random().toString(36).substring(2, 5)}`;
      await db.query(
        `INSERT INTO medication_reminders (id, appointment_id, patient_id, medication_name, dosage, frequency, scheduled_time, status, reminder_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [remId1, appointmentId, appointment.patient_id, drugName, dosage, frequency, '08:00 AM', 'pending', today]
      );

      // If 2x daily or evening frequency, schedule evening dose
      if (frequency.toLowerCase().includes('2x') || frequency.toLowerCase().includes('evening') || frequency.toLowerCase().includes('twice')) {
        const remId2 = `rem-${Date.now()}-pm-${Math.random().toString(36).substring(2, 5)}`;
        await db.query(
          `INSERT INTO medication_reminders (id, appointment_id, patient_id, medication_name, dosage, frequency, scheduled_time, status, reminder_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [remId2, appointmentId, appointment.patient_id, drugName, dosage, frequency, '08:00 PM', 'pending', today]
        );
      }
    }

    res.json({
      success: true,
      appointmentId,
      postVisitSummary: aiResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Patient Medication Reminders
router.get('/medication-reminders/:patientId', async (req, res) => {
  try {
    const reminders = await db.query(
      `SELECT * FROM medication_reminders WHERE patient_id = $1 ORDER BY scheduled_time ASC`,
      [req.params.patientId]
    );
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Medication Compliance Status ('taken' | 'skipped' | 'pending')
router.post('/medication-reminders/:reminderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(`UPDATE medication_reminders SET status = $1 WHERE id = $2`, [status, req.params.reminderId]);
    res.json({ success: true, reminderId: req.params.reminderId, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
