# Healthcare Appointment & Follow-Up Manager: System Design Document

## Executive Overview
This document details the architectural mechanisms governing concurrency control, schedule conflict resolution, temporary slot locking, and resilient asynchronous event delivery for the Healthcare Appointment & Follow-Up Platform.

---

### A. Double-Booking Prevention & Concurrency Control
Double-booking is eliminated at both the database and transaction isolation levels, guaranteeing safety even under high concurrency.

1. **Database Constraint Layer**:
   The `appointments` table enforces a strict multi-column unique constraint:
   $$\text{UNIQUE}(\text{doctor\_id}, \text{date}, \text{start\_time})$$
   Any parallel attempt to commit an appointment for the same doctor, date, and time slot immediately triggers a database-level unique constraint violation (`SQLITE_CONSTRAINT` / Postgres code `23505`).

2. **Atomic Verification & Commit**:
   When a booking request arrives, the backend executes an atomic verification checking:
   - Slot availability against doctor working hours and existing appointments.
   - Doctor leave registry on the requested date.
   - Active temporary holds by other sessions.

3. **Concurrency Race Resolution**:
   If Patient A and Patient B simultaneously attempt to book the identical slot:
   - Request A acquires the insert lock and commits successfully (`HTTP 201 CREATED`).
   - Request B hits the unique constraint, triggers an immediate rollback, and is returned an explicit conflict error: `HTTP 409 CONCURRENCY_ERROR` with message *"The selected appointment slot has already been booked by another patient."*

---

### B. Doctor Leave Conflict Handling
When a doctor is granted leave (or an administrator approves a multi-day leave request), the system prevents silent data loss and maintains continuity of care through automated schedule reconciliation:

1. **Conflict Detection**:
   The `leaveService` queries all active appointments (`status IN ('booked', 'rescheduled')`) assigned to the doctor across the requested leave date range ($[\text{from\_date}, \text{to\_date}]$).

2. **Explicit Status Transition**:
   Existing bookings are not purged; their status is explicitly transitioned to `'cancelled'` (or `'reschedule_required'`) to preserve audit history and clinical continuity.

3. **Patient & Doctor Notification**:
   For every cancelled appointment, the system automatically:
   - Queues a targeted `sendDoctorLeaveNotice` email to the patient with the doctor's name, affected date/time, and leave rationale.
   - Deletes/cancels the corresponding Google Calendar event.
   - Prompts the patient to choose an alternative open slot or consulting physician.

4. **Slot Generation Masking**:
   The slot generation algorithm cross-references `leave_days` and suppresses all slot intervals on confirmed leave dates, rendering them unavailable across the search interface.

---

### C. Temporary Slot Hold Mechanism
To prevent race conditions during patient symptom entry and pre-visit AI brief review, the system implements a transient slot hold protocol:

1. **Slot Acquisition**:
   When a patient selects an available slot in Step 1 of the booking wizard, a temporary hold token is registered in cache/memory with a configurable TTL (Time-To-Live, typically 10 minutes).

2. **Slot Exclusivity**:
   While the hold is active, `GET /api/appointments/available-slots` marks the slot as `HELD` (`isHeld: true`), hiding it from other browsing patients.

3. **Lifecycle Resolution**:
   - **Confirmation**: Upon successful symptom submission and final confirmation, the hold token is consumed and converted into a permanent `appointments` record.
   - **Timeout / Abandonment**: If the patient exits or the 10-minute timer expires, the hold is purged automatically, returning the slot to `AVAILABLE` status.

---

### D. Notification Reliability & Fault Tolerance
All email notifications, medication reminders, calendar synchronization tasks, and AI operations are decoupled from synchronous request lifecycles using an asynchronous job queue.

1. **Queued Background Execution**:
   Transactional requests (e.g., booking, cancellation, prescription entry) commit database records first and enqueue background jobs (`emailQueue`, `calendarQueue`, `medicationQueue`, `aiRetryQueue`).

2. **Exponential Backoff & Retries**:
   Transient failures (network timeouts, SMTP rate limits, Google API rate quotas) trigger automatic retries with exponential backoff:
   $$\text{Delay}(n) = \text{Base} \times 2^n + \text{jitter}$$
   Jobs are attempted up to 3 times before transitioning to a dead-letter state.

3. **Independent Availability**:
   External service failures (Ollama offline, Gmail SMTP down, Google Calendar outage) **never fail or corrupt the appointment booking transaction**. Fallback heuristic clinical NLP engines generate pre-visit briefs offline, while queued email/calendar tasks retry in the background.

4. **Prescription Medication Reminders**:
   When a physician records a prescription, the system parses the dosage frequency (e.g., *"Twice daily after food"*, *"Three times daily"*) and schedules recurring morning/evening reminders until the treatment duration ends.
