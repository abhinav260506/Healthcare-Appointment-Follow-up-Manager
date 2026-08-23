import express from 'express';
import { db } from '../db/index.js';
import { leaveService } from '../services/leaveService.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const router = express.Router();

// Get all Doctors (with Specialisation filter)
router.get('/', async (req, res) => {
  try {
    const { specialisation, search } = req.query;
    let sql = `
      SELECT d.*, u.name, u.email 
      FROM doctors d 
      JOIN users u ON d.user_id = u.id 
      WHERE d.is_active = true
    `;
    const params = [];

    if (specialisation && specialisation !== 'All') {
      params.push(specialisation);
      sql += ` AND d.specialisation = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (u.name LIKE $${params.length} OR d.specialisation LIKE $${params.length})`;
    }

    sql += ` ORDER BY u.name ASC`;

    const doctors = await db.query(sql, params);
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Doctor Leave Requests (Admin or Doctor)
router.get('/leave-requests', async (req, res) => {
  try {
    const { doctorId } = req.query;
    const requests = await leaveService.getLeaveRequests(doctorId ? String(doctorId) : null);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Doctor Submits Leave Request (from_date, to_date, reason)
router.post('/leave-requests', async (req, res) => {
  try {
    const { doctorId, fromDate, toDate, reason } = req.body;
    if (!doctorId || !fromDate || !toDate || !reason) {
      return res.status(400).json({ error: 'doctorId, fromDate, toDate, and reason are required' });
    }

    const request = await leaveService.submitLeaveRequest(doctorId, fromDate, toDate, reason);
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Responds to Doctor Leave Request (Approve or Reject)
router.post('/leave-requests/:id/respond', async (req, res) => {
  try {
    const { status, adminResponse } = req.body; // status: 'approved' | 'rejected'
    const result = await leaveService.respondLeaveRequest(req.params.id, status, adminResponse);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Doctor Cancels a Pending Leave Request
router.delete('/leave-requests/:id', async (req, res) => {
  try {
    const request = await db.queryOne(`SELECT * FROM leave_requests WHERE id = $1`, [req.params.id]);
    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending leave requests can be cancelled. Approved/rejected requests cannot be deleted.' });
    }
    await db.query(`DELETE FROM leave_requests WHERE id = $1`, [req.params.id]);
    res.json({ success: true, message: 'Leave request cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Doctor Detail
router.get('/:id', async (req, res) => {
  try {
    const doctor = await db.queryOne(
      `SELECT d.*, u.name, u.email 
       FROM doctors d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const leaves = await db.query(
      `SELECT * FROM leave_days WHERE doctor_id = $1 ORDER BY leave_date ASC`,
      [doctor.id]
    );

    res.json({ ...doctor, leaves });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create New Doctor Profile
router.post('/', async (req, res) => {
  try {
    const { name, email, specialisation, workingStart, workingEnd, slotDuration, breakStart, breakEnd } = req.body;

    if (!name || !email || !specialisation) {
      return res.status(400).json({ error: 'name, email, and specialisation are required' });
    }

    const existingUser = await db.queryOne(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email is already registered' });
    }

    // Generate a secure temporary password the admin can share with the doctor
    const tempPassword = `Dr${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const userId = `usr-doc-${randomUUID().slice(0, 8)}`;
    await db.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, name, email, passwordHash, 'doctor', 'ACTIVE', 1]
    );

    const docId = `doc-${randomUUID().slice(0, 8)}`;
    await db.query(
      `INSERT INTO doctors (id, user_id, specialisation, working_start, working_end, slot_duration, break_start, break_end) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [docId, userId, specialisation, workingStart || '09:00', workingEnd || '17:00', parseInt(slotDuration || '30', 10), breakStart || '13:00', breakEnd || '14:00']
    );

    // Return the temp password so admin can send it to the doctor
    res.status(201).json({
      id: docId,
      name,
      email,
      specialisation,
      tempPassword,
      message: `Doctor profile created. Share this temporary password with ${name}: ${tempPassword}`
    });
  } catch (err) {
    console.error('[Add Doctor Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update Doctor Schedule & Configuration
router.put('/:id', async (req, res) => {
  try {
    const { specialisation, workingStart, workingEnd, slotDuration, breakStart, breakEnd, isActive } = req.body;

    await db.query(
      `UPDATE doctors 
       SET specialisation = $1, working_start = $2, working_end = $3, slot_duration = $4, break_start = $5, break_end = $6, is_active = $7 
       WHERE id = $8`,
      [specialisation, workingStart, workingEnd, parseInt(slotDuration, 10), breakStart, breakEnd, isActive !== undefined ? isActive : true, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
