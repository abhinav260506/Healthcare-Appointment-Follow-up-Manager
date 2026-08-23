import axios from 'axios';
import { User, Doctor, Appointment, TimeSlot, PreVisitSummary, PostVisitSummary, MedicationReminder, EmailLog, RedisMetrics, LeaveRequest } from '../types';

let rawBase = import.meta.env.VITE_API_URL || '/api';
if (rawBase.startsWith('http') && !rawBase.endsWith('/api') && !rawBase.includes('/api')) {
  rawBase = rawBase.replace(/\/+$/, '') + '/api';
}
const API_BASE = rawBase;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT Bearer Token to all outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  verifyTotpLogin: async (challengeId: string, code: string) => {
    const res = await api.post('/auth/2fa/verify-login', { challengeId, code });
    return res.data;
  },
  setupTotp: async (userId: string, email: string) => {
    const res = await api.post('/auth/2fa/setup', { userId, email });
    return res.data;
  },
  verifyTotpSetup: async (userId: string, secret: string, code: string) => {
    const res = await api.post('/auth/2fa/verify-setup', { userId, secret, code });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  register: async (data: any) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  verifyEmail: async (email: string, verificationCode: string) => {
    const res = await api.post('/auth/verify-email', { email, verificationCode });
    return res.data;
  },
  resendCode: async (email: string) => {
    const res = await api.post('/auth/resend-code', { email });
    return res.data;
  }
};

export const doctorApi = {
  getAll: async (specialisation?: string, search?: string): Promise<Doctor[]> => {
    const res = await api.get('/doctors', { params: { specialisation, search } });
    return res.data;
  },
  getOne: async (id: string): Promise<Doctor> => {
    const res = await api.get(`/doctors/${id}`);
    return res.data;
  },
  create: async (data: any): Promise<Doctor> => {
    const res = await api.post('/doctors', data);
    return res.data;
  },
  update: async (id: string, data: any): Promise<any> => {
    const res = await api.put(`/doctors/${id}`, data);
    return res.data;
  },
  getLeaves: async (): Promise<LeaveRequest[]> => {
    const res = await api.get('/doctors/leave-requests');
    return res.data;
  },
  getLeaveRequests: async (doctorId?: string): Promise<LeaveRequest[]> => {
    const res = await api.get('/doctors/leave-requests', { params: { doctorId } });
    return res.data;
  },
  submitLeave: async (doctorId: string, fromDate: string, toDate: string, reason: string): Promise<any> => {
    const res = await api.post('/doctors/leave-requests', { doctorId, fromDate, toDate, reason });
    return res.data;
  },
  submitLeaveRequest: async (doctorId: string, fromDate: string, toDate: string, reason: string): Promise<any> => {
    const res = await api.post('/doctors/leave-requests', { doctorId, fromDate, toDate, reason });
    return res.data;
  },
  reviewLeave: async (leaveId: string, status: string): Promise<any> => {
    const res = await api.post(`/doctors/leave-requests/${leaveId}/respond`, { status });
    return res.data;
  },
  respondLeaveRequest: async (leaveId: string, status: string, adminResponse?: string): Promise<any> => {
    const res = await api.post(`/doctors/leave-requests/${leaveId}/respond`, { status, adminResponse });
    return res.data;
  },
  cancelLeaveRequest: async (leaveId: string): Promise<any> => {
    const res = await api.delete(`/doctors/leave-requests/${leaveId}`);
    return res.data;
  }
};

export const appointmentApi = {
  getAvailableSlots: async (doctorId: string, date: string): Promise<{ date: string; slots: TimeSlot[]; totalSlots: number; isDoctorOnLeave?: boolean; isOnLeave?: boolean; leaveReason?: string }> => {
    const res = await api.get('/appointments/available-slots', { params: { doctorId, date } });
    const data = res.data;
    return {
      ...data,
      isOnLeave: data.isDoctorOnLeave || false,
      leaveReason: data.leaveReason || 'Doctor is on scheduled leave'
    };
  },
  book: async (bookingData: { patientId: string; doctorId: string; date: string; startTime: string; symptoms: string; duration?: string; severity?: number; medicalHistory?: string }) => {
    const res = await api.post('/appointments/book', bookingData);
    return res.data;
  },
  getPatientAppointments: async (patientId: string): Promise<Appointment[]> => {
    const res = await api.get(`/appointments/patient/${patientId}`);
    return res.data;
  },
  getDoctorAgenda: async (doctorId: string, date?: string): Promise<Appointment[]> => {
    const res = await api.get(`/appointments/doctor/${doctorId}`, { params: { date } });
    return res.data;
  },
  cancel: async (appointmentId: string, reason?: string) => {
    const res = await api.post(`/appointments/${appointmentId}/cancel`, { reason });
    return res.data;
  },
  analyzeSymptoms: async (data: { symptoms: string; duration?: string; severity?: number }): Promise<PreVisitSummary> => {
    const res = await api.post('/appointments/analyze-symptoms', data);
    return res.data;
  }
};

export const visitApi = {
  submitVisit: async (appointmentId: string, diagnosis: string, clinicalNotes: string, vitals: any, prescriptions: any[]) => {
    const res = await api.post('/consultations/complete', {
      appointmentId,
      diagnosis,
      clinicalNotes,
      vitals,
      prescriptions
    });
    return res.data;
  }
};

export const consultationApi = {
  submitVisit: async (appointmentId: string, diagnosis: string, clinicalNotes: string, vitals: any, prescriptions: any[]) => {
    const res = await api.post('/consultations/complete', {
      appointmentId,
      diagnosis,
      clinicalNotes,
      vitals,
      prescriptions
    });
    return res.data;
  },
  complete: async (data: any) => {
    const { appointmentId, diagnosis, clinicalNotes, vitals, prescriptions } = data;
    const res = await api.post('/consultations/complete', {
      appointmentId,
      diagnosis,
      clinicalNotes,
      vitals,
      prescriptions
    });
    return res.data;
  },
  getReminders: async (patientId?: string): Promise<MedicationReminder[]> => {
    const url = patientId ? `/consultations/medication-reminders/${patientId}` : '/consultations/medication-reminders/all';
    const res = await api.get(url);
    return res.data;
  },
  getMedicationReminders: async (patientId?: string): Promise<MedicationReminder[]> => {
    const url = patientId ? `/consultations/medication-reminders/${patientId}` : '/consultations/medication-reminders/all';
    const res = await api.get(url);
    return res.data;
  },
  updateMedicationStatus: async (reminderId: string, status: string): Promise<any> => {
    const res = await api.post(`/consultations/medication-reminders/${reminderId}/status`, { status });
    return res.data;
  }
};

export const systemApi = {
  getEmailLogs: async (): Promise<EmailLog[]> => {
    const res = await api.get('/admin/email-logs');
    return res.data;
  },
  getRedisMetrics: async (): Promise<RedisMetrics> => {
    const res = await api.get('/admin/redis-metrics');
    return res.data;
  },
  saveApiKey: async (key: string) => {
    const res = await api.post('/admin/api-key', { apiKey: key });
    return res.data;
  },
  updateGeminiKey: async (key: string) => {
    const res = await api.post('/admin/api-key', { apiKey: key });
    return res.data;
  }
};

export const adminApi = systemApi;
