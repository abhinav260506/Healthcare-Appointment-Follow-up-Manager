import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/index.js';
import { startBackgroundWorkers } from './jobs/queue.js';

import authRoutes from './routes/auth.js';
import doctorRoutes from './routes/doctors.js';
import appointmentRoutes from './routes/appointments.js';
import consultationRoutes from './routes/consultations.js';
import systemRoutes from './routes/system.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Healthcare Platform REST API',
    architecture: {
      db: process.env.POSTGRES_URL ? 'PostgreSQL' : 'SQLite Database Engine',
      queue: process.env.REDIS_URL ? 'Redis Server' : 'In-Memory Redis Queue Engine',
      llm: process.env.GEMINI_API_KEY ? 'Google Gemini AI' : 'LLM Engine with Graceful Fallback'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/system', systemRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[REST API Error]:', err.stack);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// Initialize Database, Workers, and Start Server
async function startServer() {
  try {
    await initDb();
    startBackgroundWorkers();

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Healthcare Platform Express REST API Running!`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
