# Healthcare Platform - REST API Reference Documentation

Base URL: `http://localhost:3001/api`

---

## 1. Authentication & User Management (`/auth`)

### `POST /auth/register`
Registers a new Patient account in `PENDING_VERIFICATION` status and dispatches a 6-digit email verification OTP.
* **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password123!",
    "phone": "+1234567890",
    "dob": "1995-06-15",
    "gender": "Female"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "message": "Registration successful. Please verify your email with the 6-digit OTP code sent.",
    "userId": "usr-123456",
    "email": "jane@example.com",
    "requiresVerification": true
  }
  ```

---

### `POST /auth/verify-email`
Verifies a patient's 6-digit OTP or URL activation link, activates account status to `ACTIVE`, and issues a JWT token.
* **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "verificationCode": "849201"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "message": "Account verified and activated successfully!",
    "user": { "id": "usr-123456", "name": "Jane Doe", "email": "jane@example.com", "role": "patient" },
    "token": "eyJhbGciOi..."
  }
  ```

---

### `POST /auth/login`
Unified login endpoint for Patients, Doctors, and Admins.
* **Request Body:**
  ```json
  {
    "email": "doctor@health.org",
    "password": "Password123!"
  }
  ```
* **Response when MFA is required (200 OK):**
  ```json
  {
    "requiresMfa": true,
    "email": "doctor@health.org",
    "userId": "usr-doc1",
    "role": "doctor",
    "mfaSessionToken": "eyJhbGciOi..."
  }
  ```
* **Response when Authenticated (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": { "id": "usr-pat1", "name": "Jane Doe", "email": "jane@example.com", "role": "patient" }
  }
  ```

---

### `POST /auth/2fa/verify-login`
Completes TOTP MFA challenge with a 6-digit authenticator code or 8-character recovery code.
* **Request Body:**
  ```json
  {
    "userId": "usr-doc1",
    "token": "482910"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": { "id": "usr-doc1", "name": "Dr. Sarah Smith", "email": "doctor@health.org", "role": "doctor" }
  }
  ```

---

## 2. Appointment Booking & Availability (`/appointments`)

### `GET /appointments/available-slots`
Generates available consultation slots for a doctor on a specific date, filtering out booked slots, temporary holds, and doctor leave.
* **Query Parameters:** `doctorId=doc-1&date=2026-11-15`
* **Response (200 OK):**
  ```json
  {
    "date": "2026-11-15",
    "totalSlots": 12,
    "isDoctorOnLeave": false,
    "slots": [
      { "startTime": "09:00", "endTime": "09:30", "isAvailable": true },
      { "startTime": "09:30", "endTime": "10:00", "isAvailable": false, "status": "booked" },
      { "startTime": "10:00", "endTime": "10:30", "isAvailable": true }
    ]
  }
  ```

---

### `POST /appointments/analyze-symptoms`
Runs real-time clinical NLP / LLM triage on patient symptoms before confirming booking.
* **Request Body:**
  ```json
  {
    "symptoms": "Severe abdominal cramps with burning acid reflux",
    "duration": "2 days",
    "severity": 7
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "urgency_level": "Medium",
    "chief_complaint": "Patient presents with severe abdominal cramps with burning acid reflux lasting approximately 2 days (Severity: 7/10).",
    "symptom_cause": "Abdominal symptoms are commonly associated with acute gastroenteritis, dietary intolerance, gastritis, GERD acid reflux, or irritable bowel changes.",
    "initial_care": "Sip Oral Rehydration Solution (ORS) or electrolyte water in small amounts. Apply a warm compress to the abdomen. Stick to clear broths and crackers.",
    "suggested_questions": [
      "Where exactly is the pain located (upper, lower, right, left), and does it radiate to the back?",
      "Have you experienced vomiting, diarrhea, or difficulty keeping liquids down?",
      "Does eating food relieve the discomfort or make it significantly worse?"
    ],
    "medicines_to_avoid": "Avoid NSAID painkillers (ibuprofen, naproxen) which can irritate stomach lining.",
    "red_flags": "Seek urgent care if you experience severe localized right lower abdominal pain, vomiting blood, or black tarry stools."
  }
  ```

---

### `POST /appointments/book`
Creates an appointment with double-booking prevention, saves patient symptom form, and creates AI pre-visit brief.
* **Request Body:**
  ```json
  {
    "patientId": "usr-pat1",
    "doctorId": "doc-1",
    "date": "2026-11-15",
    "startTime": "10:00",
    "symptoms": "Throbbing headache with visual aura",
    "duration": "2 days",
    "severity": 6,
    "medicalHistory": "Migraines"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "appointment": {
      "id": "app-1787483168190",
      "patient_id": "usr-pat1",
      "doctor_id": "doc-1",
      "date": "2026-11-15",
      "start_time": "10:00",
      "end_time": "10:30",
      "status": "booked"
    },
    "preVisitSummary": {
      "urgency_level": "High",
      "chief_complaint": "Patient presents with throbbing headache with visual aura..."
    }
  }
  ```
* **Error Response on Concurrency Collision (409 Conflict):**
  ```json
  {
    "error": "CONCURRENCY_ERROR: Selected slot has already been booked by another patient."
  }
  ```

---

### `POST /appointments/:id/cancel`
Cancels an active appointment, updates status to `cancelled`, sends email notification, and updates Google Calendar.
* **Request Body:** `{ "reason": "Schedule conflict" }`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Appointment cancelled successfully"
  }
  ```

---

## 3. Consultations & Prescriptions (`/consultations`)

### `POST /consultations/complete`
Submits doctor consultation notes, diagnosis, vitals, prescriptions, and auto-schedules medication reminder notifications.
* **Request Body:**
  ```json
  {
    "appointmentId": "app-1787483168190",
    "doctorId": "doc-1",
    "patientId": "usr-pat1",
    "diagnosis": "Acute Tension Headache",
    "clinicalNotes": "Patient presents with occipital muscle tightness from prolonged desk posture.",
    "vitals": { "bp": "118/78", "pulse": "72", "temp": "98.6 F" },
    "prescriptions": [
      { "drug": "Paracetamol", "dosage": "500 mg", "frequency": "Twice daily after food", "duration": "3 days" }
    ],
    "followUpDate": "2026-11-22"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "consultation": { "id": "cons-1787489001", "diagnosis": "Acute Tension Headache" },
    "postVisitSummary": {
      "patient_friendly_summary": "During today's visit, your doctor diagnosed Acute Tension Headache...",
      "medication_schedule": [
        { "time": "08:00 AM", "medication": "Paracetamol (500 mg)", "instructions": "Twice daily after food" },
        { "time": "08:00 PM", "medication": "Paracetamol (500 mg)", "instructions": "Twice daily after food" }
      ],
      "follow_up_steps": ["Take all prescribed medications", "Rest in ergonomic posture", "Follow up on 2026-11-22"]
    }
  }
  ```

---

## 4. Doctor Leave Management (`/doctors/leave-requests`)

### `POST /doctors/leave-requests`
Doctor submits a multi-day leave request.
* **Request Body:**
  ```json
  {
    "doctorId": "doc-1",
    "fromDate": "2026-12-01",
    "toDate": "2026-12-05",
    "reason": "Annual Medical Symposium"
  }
  ```

### `POST /doctors/leave-requests/:id/respond` (Admin only)
Admin approves or rejects the leave request. If approved, all conflicting active appointments are cancelled and affected patients are notified.
* **Request Body:** `{ "status": "approved", "adminResponse": "Granted" }`
* **Response (200 OK):**
  ```json
  {
    "leaveRequestId": "lr-178749001",
    "status": "approved",
    "affectedCount": 3,
    "affectedPatients": [
      { "patientName": "Jane Doe", "patientEmail": "jane@example.com", "date": "2026-12-01", "time": "10:00" }
    ]
  }
  ```
