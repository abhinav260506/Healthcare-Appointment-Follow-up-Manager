export type UserRole = 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  doctorId?: string | null;
}

export interface Doctor {
  id: string;
  user_id: string;
  name: string;
  email: string;
  specialisation: string;
  working_start: string;
  working_end: string;
  slot_duration: number;
  break_start?: string;
  break_end?: string;
  is_active: boolean;
  leaves?: LeaveDay[];
}

export interface LeaveDay {
  id: string;
  doctor_id: string;
  leave_date: string;
  reason: string;
}

export interface LeaveRequest {
  id: string;
  doctor_id: string;
  doctor_name?: string;
  doctor_email?: string;
  specialisation?: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_response?: string;
  created_at?: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  isBreak?: boolean;
  isBooked?: boolean;
}

export interface SymptomForm {
  symptoms: string;
  duration: string;
  severity: number;
  medicalHistory?: string;
}

export interface PreVisitSummary {
  urgency_level: 'Low' | 'Medium' | 'High' | 'Critical';
  chief_complaint: string;
  symptom_cause?: string;
  initial_care?: string;
  prevention_tips?: string;
  medicines_to_avoid?: string;
  red_flags?: string;
  suggested_next_visit?: string;
  suggested_questions: string[];
  raw_llm_output?: string;
  status: 'success' | 'fallback';
  provider?: string;
}

export interface PostVisitSummary {
  patient_friendly_summary: string;
  medication_schedule: Array<{
    time: string;
    medication: string;
    instructions: string;
  }>;
  follow_up_steps: string[];
  raw_llm_output?: string;
  status: 'success' | 'fallback';
}

export interface PrescriptionItem {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'booked' | 'completed' | 'cancelled' | 'rescheduled';
  doctor_name?: string;
  doctor_email?: string;
  specialisation?: string;
  patient_name?: string;
  patient_email?: string;
  phone?: string;
  date_of_birth?: string;
  medical_history?: string;
  symptoms?: string;
  duration?: string;
  severity?: number;
  urgency_level?: 'Low' | 'Medium' | 'High' | 'Critical';
  chief_complaint?: string;
  suggested_questions?: string | string[];
  clinical_notes?: string;
  diagnosis?: string;
  vitals?: string | Record<string, any>;
  prescriptions?: string | PrescriptionItem[];
  patient_friendly_summary?: string;
  medication_schedule?: string | Array<{ time: string; medication: string; instructions: string }>;
  follow_up_steps?: string | string[];
}

export interface MedicationReminder {
  id: string;
  appointment_id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  scheduled_time: string;
  status: 'pending' | 'sent' | 'taken' | 'skipped';
  reminder_date: string;
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  html_content: string;
  type: 'booking' | 'reminder' | 'cancellation' | 'leave_notice';
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  last_error?: string;
  created_at: string;
}

export interface RedisMetrics {
  connected: boolean;
  mode: string;
  queues: {
    emailWorkerQueue: number;
    medicationRemindersQueue: number;
    aiSummaryRetryQueue: number;
  };
}
