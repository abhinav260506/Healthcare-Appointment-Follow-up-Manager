# Healthcare Platform - Google Calendar API Integration Guide

## 1. Google Cloud Console Configuration

To enable automated Google Calendar synchronization for both patients and doctors:

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Healthcare Appointment Manager`.
3. Enable the **Google Calendar API**:
   - Go to **APIs & Services** > **Library**.
   - Search for `Google Calendar API` and click **Enable**.
4. Configure the **OAuth Consent Screen**:
   - Choose **External** (or **Internal** if using Google Workspace).
   - Add App name, User support email, and Developer contact information.
   - Add Scopes: `https://www.googleapis.com/auth/calendar.events`.
5. Create **OAuth 2.0 Client ID**:
   - Go to **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URIs:
     - Development: `http://localhost:3001/api/calendar/oauth2callback`
     - Production: `https://your-backend-domain.com/api/calendar/oauth2callback`
6. Copy `Client ID` and `Client Secret` into your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/oauth2callback
   ```

---

## 2. Calendar Event Lifecycle

### A. Appointment Confirmation
* Event created on patient's and doctor's primary Google Calendar.
* Event title: `Consultation: Dr. [Doctor Name] with [Patient Name]`.
* Location: Clinic Consultation Suite / Telehealth Room.
* Description contains pre-visit summary and clinical focus questions.

### B. Rescheduling
* The existing `calendar_event_id` is updated with the new date and time slot.

### C. Cancellation & Doctor Leave
* Event is automatically removed (`DELETE /calendars/primary/events/{eventId}`) or marked as `Cancelled`.

### D. Direct ICS Feed & One-Click Add
* Patients can also download standard `.ics` calendar files directly via `GET /api/appointments/:id/calendar.ics` or use instant `calendar.google.com/calendar/render` web links embedded in confirmation emails.
