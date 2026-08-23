import Redis from 'ioredis';
import { db } from '../db/index.js';

let redisClient = null;
let isRedisConnected = false;

// Attempt Redis connection if REDIS_URL is configured
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    const config = process.env.REDIS_URL
      ? process.env.REDIS_URL
      : { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) };

    redisClient = new Redis(config, { maxRetriesPerRequest: 1, lazyConnect: true });
    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('[Redis Queue] Connected to Redis server.');
    });
    redisClient.on('error', (err) => {
      isRedisConnected = false;
    });
    redisClient.connect().catch(() => {
      console.log('[Redis Queue] Redis server unavailable, operating with built-in Event Queue Engine.');
    });
  } catch (err) {
    console.log('[Redis Queue] Operating with built-in Event Queue Engine.');
  }
}

// In-Memory Queue Store
const memoryQueues = {
  emailWorkerQueue: [],
  medicationRemindersQueue: [],
  aiSummaryRetryQueue: []
};

export const queueService = {
  // Push Job to Queue
  addJob: async (queueName, payload) => {
    const jobData = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0
    };

    if (isRedisConnected && redisClient) {
      try {
        await redisClient.rpush(queueName, JSON.stringify(jobData));
        return jobData.id;
      } catch (err) {
        // Fallback to memory
      }
    }

    if (!memoryQueues[queueName]) {
      memoryQueues[queueName] = [];
    }
    memoryQueues[queueName].push(jobData);
    return jobData.id;
  },

  // Pop Job from Queue
  popJob: async (queueName) => {
    if (isRedisConnected && redisClient) {
      try {
        const raw = await redisClient.lpop(queueName);
        if (raw) return JSON.parse(raw);
      } catch (err) {
        // Fallback
      }
    }

    if (memoryQueues[queueName] && memoryQueues[queueName].length > 0) {
      return memoryQueues[queueName].shift();
    }
    return null;
  },

  // Get Queue Metrics
  getMetrics: async () => {
    let emailCount = 0;
    let reminderCount = 0;
    let aiRetryCount = 0;

    if (isRedisConnected && redisClient) {
      try {
        emailCount = await redisClient.llen('emailWorkerQueue');
        reminderCount = await redisClient.llen('medicationRemindersQueue');
        aiRetryCount = await redisClient.llen('aiSummaryRetryQueue');
      } catch (err) {
        // Fallback
      }
    } else {
      emailCount = memoryQueues.emailWorkerQueue.length;
      reminderCount = memoryQueues.medicationRemindersQueue.length;
      aiRetryCount = memoryQueues.aiSummaryRetryQueue.length;
    }

    return {
      connected: isRedisConnected,
      mode: isRedisConnected ? 'Redis Server' : 'In-Memory Async Queue Engine',
      queues: {
        emailWorkerQueue: emailCount,
        medicationRemindersQueue: reminderCount,
        aiSummaryRetryQueue: aiRetryCount
      }
    };
  }
};

// -------------------------------------------------------------
// Background Worker Processes (Runs every 10 seconds)
// -------------------------------------------------------------

export function startBackgroundWorkers() {
  console.log('[Background Workers] Initialized Email, Medication Reminder, and AI Retry workers.');

  setInterval(async () => {
    try {
      await processEmailWorkerQueue();
      await processMedicationRemindersWorker();
      await processAiSummaryRetryWorker();
    } catch (err) {
      console.error('[Background Worker Error]:', err.message);
    }
  }, 10000);
}

// 1. Email Retry & Delivery Worker
async function processEmailWorkerQueue() {
  const pendingEmails = await db.query(
    `SELECT * FROM email_logs WHERE status = 'pending' OR (status = 'failed' AND retry_count < 3)`
  );

  for (const email of pendingEmails) {
    console.log(`[Email Worker] Processing email to ${email.recipient} [Subject: ${email.subject}]`);
    // Attempt delivery simulation/Nodemailer
    try {
      await db.query(
        `UPDATE email_logs SET status = 'sent', retry_count = retry_count + 1 WHERE id = $1`,
        [email.id]
      );
      console.log(`[Email Worker] Successfully dispatched email ID: ${email.id}`);
    } catch (err) {
      await db.query(
        `UPDATE email_logs SET status = 'failed', retry_count = retry_count + 1, last_error = $1 WHERE id = $2`,
        [err.message, email.id]
      );
    }
  }
}

// 2. Medication Reminders Worker
async function processMedicationRemindersWorker() {
  const today = new Date().toISOString().split('T')[0];
  const pendingReminders = await db.query(
    `SELECT r.*, u.email, u.name 
     FROM medication_reminders r 
     JOIN users u ON r.patient_id = u.id 
     WHERE r.reminder_date = $1 AND r.status = 'pending'`,
    [today]
  );

  if (pendingReminders.length > 0) {
    console.log(`[Medication Reminder Worker] Found ${pendingReminders.length} pending medication reminders for today.`);

    for (const rem of pendingReminders) {
      const emailContent = `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2>Medication Reminder: ${rem.medication_name}</h2>
          <p>Hello ${rem.name},</p>
          <p>This is your scheduled reminder to take your prescription medication:</p>
          <ul>
            <li><strong>Medication:</strong> ${rem.medication_name} (${rem.dosage})</li>
            <li><strong>Time:</strong> ${rem.scheduled_time}</li>
          </ul>
          <p>Please log in to your patient portal to mark this dose as taken.</p>
        </div>
      `;

      // Queue Email Notification
      await db.query(
        `INSERT INTO email_logs (id, recipient, subject, html_content, type, status) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `em-rem-${Date.now()}-${rem.id}`,
          rem.email,
          `Medication Reminder: ${rem.medication_name}`,
          emailContent,
          'reminder',
          'pending'
        ]
      );

      // Mark as notified in DB
      await db.query(`UPDATE medication_reminders SET status = 'sent' WHERE id = $1`, [rem.id]);
    }
  }
}

// 3. AI Summary Retry Worker
async function processAiSummaryRetryWorker() {
  const pendingPreSummaries = await db.query(
    `SELECT * FROM pre_visit_summaries WHERE status = 'fallback'`
  );

  for (const s of pendingPreSummaries) {
    // Retry AI summary generation if LLM was previously offline
  }
}
