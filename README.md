# Healthcare Appointment & Follow-Up Manager

A secure full-stack healthcare platform featuring multi-role portals (Patient, Doctor, Admin), RFC 6238 TOTP MFA, concurrent double-booking protection, offline/online LLM clinical triage, asynchronous email/calendar delivery, and prescription medication reminders.

🔗 **Live Hosted Application:** [HealthCare Platform - Appointment & Follow-up Manager](https://healthcare-appointment-follow-up-ma-taupe.vercel.app/)

---

## 🚀 Key Features

* 🔐 **Enterprise Authentication & MFA:**
  - 2-Step email OTP verification for Patients.
  - Mandatory RFC 6238 TOTP MFA for Doctors and Admins.
  - Argon2/bcrypt password hashing with JWT access tokens and secure recovery codes.
* 📅 **Intelligent Scheduling & Concurrency Safety:**
  - Database-level unique constraints (`doctor_id, date, start_time`) guaranteeing zero double-booking under race conditions.
  - Temporary 10-minute slot holding during booking flow.
  - Multi-day doctor leave management with automatic cancellation of conflicting appointments and patient email alerts.
* 🤖 **Offline & Online AI Clinical Triage:**
  - Pre-visit clinical brief generation (urgency categorization, chief complaint, tailored home care, and doctor questions).
  - Post-visit patient summary generator parsing doctor notes and prescription schedules.
  - Multi-tier resilient fallback: Local Ollama (Gemma 3 4B) ➔ Google Gemini ➔ Built-in Clinical NLP Domain Engine.
* 💊 **Prescription & Medication Reminders:**
  - Authoritative doctor prescription builder.
  - Automated morning/evening medication reminder jobs.
* 📩 **Email & Google Calendar Integration:**
  - Asynchronous email queue with exponential backoff and retry handling.
  - Direct `.ics` calendar generation and Google Calendar OAuth synchronization.

---

## 🛠️ Technology Stack

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
* **Backend:** Node.js, Express, SQLite / PostgreSQL, Better-SQLite3 / pg
* **AI / NLP:** Ollama (Gemma 3 4B), Google Gemini API, Built-in Clinical NLP Classifier
* **Security:** Speakeasy (RFC 6238 TOTP), QRCode, bcryptjs, JSON Web Tokens
* **Queue / Asynchronous Jobs:** Built-in resilient queue with retry loops, ready for Redis + BullMQ

---

## 🔑 Default Credentials

| Role | Email | Password | 2FA / MFA Setup |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@health.org` | `password123` | Mandatory TOTP (App Authenticator) |
| **Doctor** | `doctor@health.org` | `password123` | Mandatory TOTP (App Authenticator) |
| **Patient** | `patient@health.org` | `password123` | Email OTP / Optional TOTP |

---

## 🏁 Quickstart & Local Setup

### 1. Clone & Install Dependencies
```bash
git clone <repository_url>
cd health

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Development Servers
Start both backend API (`:3001`) and frontend Vite server (`:5173`):
```bash
# Terminal 1: Start Backend
npm run server

# Terminal 2: Start Frontend
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## 🧪 Running Automated Tests

Execute the comprehensive automated test suite verifying concurrent double-booking protection, doctor leave auto-cancellations, AI triage, and post-visit summaries:

```bash
node server/tests/run_tests.js
```

---

## 📖 System Design & Technical Documentation

* 📘 [System Design Document (<= 800 words)](./SYSTEM_DESIGN.md)
* 📗 [REST API Reference Documentation](./API_DOCUMENTATION.md)
* 📙 [Database Schema & ER Model](./DATABASE_SCHEMA.md)
* 🤖 [LLM Prompts & AI Triage Specification](./LLM_PROMPTS.md)
* 📅 [Google Calendar Integration Guide](./GOOGLE_CALENDAR_SETUP.md)

---

## 🚢 Deployment Architecture

* **Frontend:** Deployable on Vercel with single-page application routing (`vercel.json`).
* **Backend:** Deployable on Render / Railway / AWS ECS with Node.js 18+.
* **Database:** Compatible with Supabase, Neon, or Railway PostgreSQL via `DATABASE_URL`.
* **LLM Engine:** Run locally via Ollama or connect cloud AI models via `GEMINI_API_KEY`.
