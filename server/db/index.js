import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sqliteDb = null;
let pgPool = null;
let usePostgres = false;

// Attempt PostgreSQL connection if env var POSTGRES_URL is provided
if (process.env.POSTGRES_URL) {
  try {
    pgPool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
    usePostgres = true;
    console.log('[Database] Operating with PostgreSQL Database.');
  } catch (err) {
    console.warn('[Database] PostgreSQL connection failed, falling back to SQLite:', err.message);
  }
}

if (!usePostgres) {
  const dbPath = path.join(__dirname, 'health.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  console.log('[Database] Operating with SQLite Database at:', dbPath);
}

// Database wrapper methods providing unified async interface
export const db = {
  query: async (text, params = []) => {
    if (usePostgres) {
      const res = await pgPool.query(text, params);
      return res.rows;
    } else {
      let sql = text;
      const mappedParams = [];
      // Replace all $N with ? in positional order
      sql = sql.replace(/\$(\d+)/g, (match, num) => {
        const idx = parseInt(num, 10) - 1;
        mappedParams.push(params[idx]);
        return '?';
      });

      const stmt = sqliteDb.prepare(sql);
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      const isInsertWithReturning = sql.toUpperCase().includes('RETURNING');

      if (isSelect || isInsertWithReturning) {
        return stmt.all(...mappedParams);
      } else {
        const info = stmt.run(...mappedParams);
        return [{ changes: info.changes, lastInsertRowid: info.lastInsertRowid }];
      }
    }
  },

  queryOne: async (text, params = []) => {
    const rows = await db.query(text, params);
    return rows.length > 0 ? rows[0] : null;
  },

  transaction: async (callback) => {
    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const runTx = sqliteDb.transaction(callback);
      return runTx(sqliteDb);
    }
  }
};

export async function logAuditEvent(userId, action, entity = null, entityId = null, oldValue = null, newValue = null, ipAddress = null) {
  try {
    const id = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, old_value, new_value, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        userId || 'SYSTEM',
        action,
        entity,
        entityId,
        typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue,
        typeof newValue === 'object' ? JSON.stringify(newValue) : newValue,
        ipAddress || '127.0.0.1'
      ]
    );
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}

// Initialize DB schema & Seed data
export async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  if (!usePostgres) {
    sqliteDb.exec(schemaSql);
    // Automatic Migrations for missing columns
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 1`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE'`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN verification_code TEXT`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN totp_secret_encrypted TEXT`); } catch (e) {}
    sqliteDb.exec(`UPDATE users SET status = 'ACTIVE' WHERE status IS NULL`);
    sqliteDb.exec(`UPDATE users SET is_verified = 1 WHERE is_verified IS NULL`);
  } else {
    await pgPool.query(schemaSql);
  }

  // Seed Users & Roles if empty
  const userCount = await db.queryOne('SELECT COUNT(*) as count FROM users');
  const count = parseInt(userCount.count || userCount.COUNT || 0, 10);

  if (count === 0) {
    console.log('[Database] Seeding initial users, doctor profiles, and demo appointments...');
    await seedData();
  }
}

async function seedData() {
  const defaultPasswordHash = bcrypt.hashSync('password123', 10);

  // Users & Doctor Accounts
  const users = [
    { id: 'usr-admin', name: 'System Admin', email: 'admin@health.org', role: 'admin', is_verified: true, status: 'ACTIVE' },
    { id: 'usr-doc1', name: 'Dr. Sarah Jenkins', email: 'sarah.jenkins@health.org', role: 'doctor', is_verified: true, status: 'ACTIVE' },
    { id: 'usr-doc2', name: 'Dr. Marcus Vance', email: 'marcus.vance@health.org', role: 'doctor', is_verified: true, status: 'ACTIVE' },
    { id: 'usr-doc3', name: 'Dr. Elena Rostova', email: 'elena.rostova@health.org', role: 'doctor', is_verified: true, status: 'ACTIVE' },
    { id: 'usr-doc4', name: 'Dr. David Chen', email: 'david.chen@health.org', role: 'doctor', is_verified: true, status: 'ACTIVE' },
    { id: 'usr-pat1', name: 'John Doe', email: 'john.doe@example.com', role: 'patient', is_verified: true, status: 'ACTIVE' },
    { id: 'usr-pat2', name: 'Emily Watson', email: 'emily.watson@example.com', role: 'patient', is_verified: true, status: 'ACTIVE' },
    { id: 'usr-pat3', name: 'Robert Miller', email: 'robert.miller@example.com', role: 'patient', is_verified: true, status: 'ACTIVE' }
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [u.id, u.name, u.email, defaultPasswordHash, u.role, u.status, u.is_verified ? 1 : 0]
    );
  }

  // Doctor Profiles linked to Users
  const doctors = [
    { id: 'doc-1', user_id: 'usr-doc1', specialisation: 'Cardiology', working_start: '09:00', working_end: '17:00', slot_duration: 30, break_start: '13:00', break_end: '14:00' },
    { id: 'doc-2', user_id: 'usr-doc2', specialisation: 'Dermatology', working_start: '08:30', working_end: '16:30', slot_duration: 20, break_start: '12:30', break_end: '13:30' },
    { id: 'doc-3', user_id: 'usr-doc3', specialisation: 'Neurology', working_start: '10:00', working_end: '18:00', slot_duration: 45, break_start: '13:30', break_end: '14:30' },
    { id: 'doc-4', user_id: 'usr-doc4', specialisation: 'Pediatrics', working_start: '09:00', working_end: '15:00', slot_duration: 30, break_start: '12:00', break_end: '13:00' }
  ];

  for (const d of doctors) {
    await db.query(
      `INSERT INTO doctors (id, user_id, specialisation, working_start, working_end, slot_duration, break_start, break_end) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [d.id, d.user_id, d.specialisation, d.working_start, d.working_end, d.slot_duration, d.break_start, d.break_end]
    );
  }

  // Patients
  const patients = [
    { id: 'pat-1', user_id: 'usr-pat1', phone: '+1-555-0192', date_of_birth: '1988-04-12', medical_history: 'Hypertension, Mild Asthma' },
    { id: 'pat-2', user_id: 'usr-pat2', phone: '+1-555-0384', date_of_birth: '1992-09-25', medical_history: 'Penicillin Allergy' },
    { id: 'pat-3', user_id: 'usr-pat3', phone: '+1-555-0721', date_of_birth: '1975-11-03', medical_history: 'Type 2 Diabetes' }
  ];

  for (const p of patients) {
    await db.query(
      `INSERT INTO patients (id, user_id, phone, date_of_birth, medical_history) VALUES ($1, $2, $3, $4, $5)`,
      [p.id, p.user_id, p.phone, p.date_of_birth, p.medical_history]
    );
  }

  // Demo Appointments
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const app1 = { id: 'app-101', patient_id: 'usr-pat1', doctor_id: 'doc-1', date: today, start_time: '10:00', end_time: '10:30', status: 'booked' };
  const app2 = { id: 'app-102', patient_id: 'usr-pat2', doctor_id: 'doc-2', date: tomorrow, start_time: '11:00', end_time: '11:20', status: 'booked' };
  const app3 = { id: 'app-103', patient_id: 'usr-pat3', doctor_id: 'doc-3', date: nextWeek, start_time: '14:00', end_time: '14:45', status: 'booked' };

  for (const a of [app1, app2, app3]) {
    await db.query(
      `INSERT INTO appointments (id, patient_id, doctor_id, date, start_time, end_time, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [a.id, a.patient_id, a.doctor_id, a.date, a.start_time, a.end_time, a.status]
    );
  }

  // Symptom Form for App 1
  await db.query(
    `INSERT INTO symptom_forms (id, appointment_id, symptoms, duration, severity, medical_history) VALUES ($1, $2, $3, $4, $5, $6)`,
    ['sym-101', 'app-101', 'Sharp chest discomfort on exertion, mild shortness of breath during morning walk', '3 days', 7, 'Hypertension, Mild Asthma']
  );

  // Pre-visit AI summary for App 1
  await db.query(
    `INSERT INTO pre_visit_summaries (id, appointment_id, urgency_level, chief_complaint, suggested_questions, raw_llm_output, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      'pvs-101',
      'app-101',
      'High',
      'Exertional chest discomfort and shortness of breath with pre-existing hypertension.',
      JSON.stringify([
        'Does the chest discomfort radiate to your jaw, back, or left arm?',
        'Does resting or taking nitroglycerin reduce the intensity?',
        'Have you experienced any dizziness, palpitations, or ankle edema recently?'
      ]),
      'AI Analysis completed successfully via Gemini model.',
      'success'
    ]
  );

  console.log('[Database] Seed completed successfully.');
}
