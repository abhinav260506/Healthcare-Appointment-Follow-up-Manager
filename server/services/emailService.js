import nodemailer from 'nodemailer';
import { db } from '../db/index.js';
import { calendarService } from './calendarService.js';

let transporter = null;

// Initialize Nodemailer Transport
try {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
} catch (err) {
  console.warn('[Email Service] Standard SMTP transporter not configured, operating with local inbox log simulation.');
}

export const emailService = {
  // Dispatch 2-Step Verification Email with Code & Activation Link
  sendVerificationEmail: async (patientName, recipientEmail, verificationCode) => {
    const activationLink = `http://localhost:5173/?verify_email=${encodeURIComponent(recipientEmail)}&code=${verificationCode}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0284c7; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Activate Your Patient Account</h1>
          <p style="margin: 4px 0 0 0; opacity: 0.9;">Healthcare Management Platform</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello <strong>${patientName}</strong>,</p>
          <p>Thank you for registering on the HealthCare Platform. Please verify your email address to activate your patient portal account.</p>
          
          <div style="background-color: #f0f9ff; border: 2px dashed #0284c7; padding: 20px; text-align: center; margin: 24px 0; border-radius: 10px;">
            <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Your 6-Digit Email Verification Code</p>
            <span style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #0284c7;">${verificationCode}</span>
          </div>

          <div style="margin: 28px 0; text-align: center;">
            <a href="${activationLink}" target="_blank" style="display: inline-block; background-color: #0284c7; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              ✓ Click Here to Activate Account
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="${activationLink}" style="color: #0284c7;">${activationLink}</a></p>
        </div>
      </div>
    `;

    await queueEmail(recipientEmail, `2-Step Email Verification: ${verificationCode}`, htmlContent, 'reminder');
  },

  // Dispatch Booking Confirmation Email
  sendBookingConfirmation: async (appointment, doctor, patient) => {
    const googleCalUrl = calendarService.generateGoogleCalendarUrl(appointment, doctor);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0284c7; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Appointment Confirmed!</h1>
          <p style="margin: 4px 0 0 0; opacity: 0.9;">Healthcare Management Platform</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello <strong>${patient.name}</strong>,</p>
          <p>Your appointment with <strong>${doctor.name}</strong> (${doctor.specialisation}) has been successfully booked.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0;"><strong>Date:</strong> ${appointment.date}</p>
            <p style="margin: 6px 0 0 0;"><strong>Time Slot:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
            <p style="margin: 6px 0 0 0;"><strong>Doctor:</strong> ${doctor.name} (${doctor.specialisation})</p>
            <p style="margin: 6px 0 0 0;"><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">Confirmed</span></p>
          </div>

          <div style="margin: 24px 0; text-align: center;">
            <a href="${googleCalUrl}" target="_blank" style="display: inline-block; background-color: #0284c7; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
              + Add to Google Calendar
            </a>
          </div>

          <p style="font-size: 13px; color: #64748b;">If you need to reschedule or cancel your appointment, please log in to your patient dashboard.</p>
        </div>
      </div>
    `;

    // Dispatch to Patient
    await queueEmail(patient.email, `Booking Confirmation: Appointment with ${doctor.name}`, htmlContent, 'booking');

    // Dispatch to Doctor
    const doctorHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <h2>New Patient Appointment Booked</h2>
        <p>Dear ${doctor.name},</p>
        <p>A new appointment has been scheduled:</p>
        <ul>
          <li><strong>Patient Name:</strong> ${patient.name} (${patient.email})</li>
          <li><strong>Date:</strong> ${appointment.date}</li>
          <li><strong>Time:</strong> ${appointment.start_time} - ${appointment.end_time}</li>
        </ul>
        <p>You can view the patient's pre-visit symptom brief in your Doctor Dashboard.</p>
      </div>
    `;
    await queueEmail(doctor.email, `New Appointment Booked: ${patient.name}`, doctorHtml, 'booking');
  },

  // Dispatch Cancellation Email
  sendCancellationNotice: async (appointment, doctor, patient, reason = 'Cancelled by user') => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Appointment Cancellation Notice</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${patient.name}</strong>,</p>
          <p>Your appointment scheduled for <strong>${appointment.date}</strong> at <strong>${appointment.start_time}</strong> with <strong>${doctor.name}</strong> has been cancelled.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p style="margin-top: 20px;">You can book a new appointment slot anytime through your patient portal.</p>
        </div>
      </div>
    `;

    await queueEmail(patient.email, `Cancelled: Appointment on ${appointment.date}`, htmlContent, 'cancellation');
    await queueEmail(doctor.email, `Cancelled Appointment: ${patient.name} on ${appointment.date}`, htmlContent, 'cancellation');
  },

  // Dispatch Leave Impact Notice to Patient
  sendDoctorLeaveNotice: async (appointment, doctor, patient, leaveDate, reason) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fde68a; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #d97706; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Important: Doctor Schedule Change</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Dear <strong>${patient.name}</strong>,</p>
          <p>We regret to inform you that <strong>${doctor.name}</strong> will be away on leave on <strong>${leaveDate}</strong> (${reason || 'Unscheduled Leave'}).</p>
          
          <div style="background-color: #fffbebf; border-left: 4px solid #d97706; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Impacted Visit:</strong> ${appointment.date} at ${appointment.start_time}</p>
            <p style="margin: 4px 0 0 0;"><strong>Status:</strong> Automatically Cancelled / Quick Reschedule Available</p>
          </div>

          <p>Please log in to your patient portal to choose a new convenient appointment slot with ${doctor.name} or another specialist.</p>
        </div>
      </div>
    `;

    await queueEmail(patient.email, `Important Notice: Doctor Leave Schedule Change for ${leaveDate}`, htmlContent, 'leave_notice');
  }
};

async function queueEmail(recipient, subject, htmlContent, type) {
  const emailId = `em-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  
  await db.query(
    `INSERT INTO email_logs (id, recipient, subject, html_content, type, status) VALUES ($1, $2, $3, $4, $5, $6)`,
    [emailId, recipient, subject, htmlContent, type, 'sent']
  );

  if (transporter) {
    transporter.sendMail({
      from: '"HealthCare Platform" <noreply@healthcare.org>',
      to: recipient,
      subject: subject,
      html: htmlContent
    }).catch(err => {
      console.warn(`[Email Service] SMTP send warning for ${recipient}:`, err.message);
    });
  }
}
