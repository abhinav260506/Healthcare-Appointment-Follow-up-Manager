import { google } from 'googleapis';
import { createEvent } from 'ics';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'MOCK_GOOGLE_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'MOCK_GOOGLE_CLIENT_SECRET',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
);

export const calendarService = {
  // Generate iCalendar (.ics) File Content
  generateIcs: (appointment, doctor, patient) => {
    return new Promise((resolve, reject) => {
      const [year, month, day] = appointment.date.split('-').map(Number);
      const [startHour, startMin] = appointment.start_time.split(':').map(Number);
      const [endHour, endMin] = appointment.end_time.split(':').map(Number);

      const event = {
        start: [year, month, day, startHour, startMin],
        end: [year, month, day, endHour, endMin],
        title: `Medical Appointment: ${doctor.name} (${doctor.specialisation})`,
        description: `Consultation with ${doctor.name}.\nPatient: ${patient.name}\nStatus: ${appointment.status.toUpperCase()}`,
        location: `Medical Center, Suite ${100 + Math.floor(Math.random() * 20)}`,
        status: appointment.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
        organizer: { name: doctor.name, email: doctor.email }
      };

      createEvent(event, (error, value) => {
        if (error) {
          resolve(generateBasicIcsString(appointment, doctor, patient));
        } else {
          resolve(value);
        }
      });
    });
  },

  // Generate 1-Click Add to Google Calendar URL
  generateGoogleCalendarUrl: (appointment, doctor) => {
    const title = encodeURIComponent(`Appointment with ${doctor.name} (${doctor.specialisation})`);
    const details = encodeURIComponent(`Consultation appointment at Health Manager Clinic.`);
    const location = encodeURIComponent(`Health Center Main Clinic`);

    // Format dates to ISO standard for Google Calendar URL (YYYYMMDDTHHMMSSZ)
    const dateClean = appointment.date.replace(/-/g, '');
    const startTimeClean = appointment.start_time.replace(/:/g, '') + '00';
    const endTimeClean = appointment.end_time.replace(/:/g, '') + '00';

    const dates = `${dateClean}T${startTimeClean}/${dateClean}T${endTimeClean}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  },

  // Get Google OAuth Auth URL
  getAuthUrl: () => {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events']
    });
  }
};

function generateBasicIcsString(appointment, doctor, patient) {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HealthCare Platform//NONSGML v1.0//EN
BEGIN:VEVENT
UID:apt-${appointment.id}@healthcare.org
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:Medical Appointment with ${doctor.name}
DESCRIPTION:Specialisation: ${doctor.specialisation}. Patient: ${patient.name}.
LOCATION:Health Center Clinic
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}
