import React, { useState, useEffect } from 'react';
import { Appointment, Doctor } from '../../types';
import { appointmentApi, doctorApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, Sparkles, FileText, CheckCircle, XCircle, ExternalLink, Download, Pill, Stethoscope, User, Plus, RefreshCcw, ChevronRight } from 'lucide-react';
import { MedicationRemindersCard } from './MedicationRemindersCard';

interface PatientDashboardProps {
  onNewBookingClick: (doctor?: Doctor) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ onNewBookingClick }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'medications'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [aptsData, docsData] = await Promise.all([
        appointmentApi.getPatientAppointments(user.id),
        doctorApi.getAll()
      ]);
      setAppointments(aptsData);
      setAllDoctors(docsData);
    } catch (err) {
      console.error('Failed to load patient dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment? A cancellation email notice will be sent.')) return;
    setCancellingId(id);
    try {
      await appointmentApi.cancel(id, 'Cancelled by patient from portal');
      setNoticeMsg('Appointment cancelled successfully. A cancellation notice has been logged and sent to your email.');
      setTimeout(() => setNoticeMsg(null), 5000);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

  const upcomingApps = appointments.filter((a) => a.status === 'booked' || a.status === 'rescheduled');
  const pastApps = appointments.filter((a) => a.status === 'completed' || a.status === 'cancelled');

  // Extract unique doctors previously consulted by this patient
  const consultedDoctorIds = Array.from(new Set(appointments.map((a) => a.doctor_id)));
  const consultedDoctors = allDoctors.filter((d) => consultedDoctorIds.includes(d.id));

  const getUrgencyBadge = (level?: string) => {
    switch (level) {
      case 'Critical': return 'badge-critical';
      case 'High': return 'badge-high';
      case 'Medium': return 'badge-medium';
      default: return 'badge-low';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-cyan-400" />
            Patient Health Dashboard & Records
          </h2>
          <p className="text-slate-400 text-sm">
            Welcome back, <strong>{user?.name}</strong>. Access your medical records, previously consulted doctors, and active bookings.
          </p>
        </div>

        <button
          onClick={() => onNewBookingClick()}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 text-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Book New Appointment</span>
        </button>
      </div>

      {/* Notification Banner */}
      {noticeMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{noticeMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Sidebar: Previously Consulted Doctors & Quick Re-booking */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Book Sidebar Action */}
          <div className="glass-panel rounded-2xl p-5 space-y-4 border border-cyan-500/30">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Quick Appointment Booking
            </h3>
            <p className="text-xs text-slate-300">
              Select a doctor or search by specialization to reserve an appointment slot and submit your symptoms.
            </p>
            <button
              onClick={() => onNewBookingClick()}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>+ Book Appointment Now</span>
            </button>
          </div>

          {/* Previously Consulted Doctors */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Stethoscope className="w-4 h-4 text-cyan-400" />
              Previously Consulted Doctors ({consultedDoctors.length})
            </h3>

            {loading ? (
              <div className="text-xs text-slate-400 text-center py-4">Loading doctor history...</div>
            ) : consultedDoctors.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4 italic">
                You haven't completed visits with any doctors yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {consultedDoctors.map((doc) => {
                  const lastApt = appointments.find((a) => a.doctor_id === doc.id);
                  return (
                    <div key={doc.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-white text-sm">{doc.name}</div>
                          <div className="text-[11px] text-cyan-400 font-semibold">{doc.specialisation}</div>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {lastApt ? lastApt.date : 'Past Doctor'}
                        </span>
                      </div>

                      {lastApt?.diagnosis && (
                        <div className="text-[11px] text-slate-300">
                          <strong>Last Diagnosis:</strong> {lastApt.diagnosis}
                        </div>
                      )}

                      <button
                        onClick={() => onNewBookingClick(doc)}
                        className="w-full py-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 font-bold rounded-lg text-[11px] transition-all flex items-center justify-center gap-1"
                      >
                        <RefreshCcw className="w-3 h-3" />
                        <span>Re-book with {doc.name.split(' ')[1] || doc.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Main Panel: Tabs for Upcoming, Past Visit Records, and Medications */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Upcoming Appointments ({upcomingApps.length})
            </button>

            <button
              onClick={() => setActiveTab('past')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'past'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Medical Records & Summaries ({pastApps.length})
            </button>

            <button
              onClick={() => setActiveTab('medications')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'medications'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Medication Schedule
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* UPCOMING APPOINTMENTS TAB */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'upcoming' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-slate-400">Loading appointments...</div>
              ) : upcomingApps.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 space-y-3">
                  <Calendar className="w-12 h-12 text-slate-600 mx-auto opacity-40" />
                  <p className="text-sm">You have no upcoming appointments scheduled.</p>
                  <button
                    onClick={() => onNewBookingClick()}
                    className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-cyan-400"
                  >
                    + Book New Appointment
                  </button>
                </div>
              ) : (
                upcomingApps.map((apt) => (
                  <div key={apt.id} className="glass-panel rounded-2xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="font-bold text-white text-lg">{apt.doctor_name}</h3>
                        <p className="text-xs text-cyan-400 font-medium">{apt.specialisation}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {apt.severity && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-cyan-300">
                            Severity: {apt.severity}/10
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getUrgencyBadge(apt.urgency_level)}`}>
                          Urgency: {apt.urgency_level || 'Medium'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 capitalize">
                          {apt.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        <span>Date: <strong>{apt.date}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span>Time Slot: <strong>{apt.start_time} - {apt.end_time}</strong></span>
                      </div>
                    </div>

                    {/* Pre-Visit AI Summary & Severity Insight */}
                    {(apt.chief_complaint || apt.symptoms) && (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                        <div className="text-cyan-400 font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Pre-Visit Symptom Analysis:</span>
                          <span className="text-slate-400 font-normal">Reported Duration: {apt.duration || 'N/A'}</span>
                        </div>
                        <p className="text-slate-200 font-medium">{apt.chief_complaint || apt.symptoms}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                      <div className="flex items-center space-x-2">
                        <a
                          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appointment with ${apt.doctor_name}`)}&dates=${apt.date.replace(/-/g, '')}T${apt.start_time.replace(':', '')}00/${apt.date.replace(/-/g, '')}T${apt.end_time.replace(':', '')}00`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-blue-600/30"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Google Calendar
                        </a>

                        <a
                          href={`/api/appointments/${apt.id}/calendar.ics`}
                          download
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-slate-700"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-400" /> .ics iCal
                        </a>
                      </div>

                      <button
                        onClick={() => handleCancelAppointment(apt.id)}
                        disabled={cancellingId === apt.id}
                        className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50 rounded-lg border border-red-500/20 transition-all flex items-center gap-1"
                      >
                        {cancellingId === apt.id ? 'Cancelling...' : 'Cancel Booking'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* PAST VISIT RECORDS & AI POST-VISIT SUMMARIES */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'past' && (
            <div className="space-y-4">
              {pastApps.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
                  No completed or past visit records found.
                </div>
              ) : (
                pastApps.map((apt) => (
                  <div key={apt.id} className="glass-panel rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="font-bold text-white text-lg">{apt.doctor_name} ({apt.specialisation})</h3>
                        <p className="text-xs text-slate-400">Visit Date: {apt.date} at {apt.start_time}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${apt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'} capitalize`}>
                        {apt.status}
                      </span>
                    </div>

                    {/* Patient-Friendly AI Post-Visit Summary */}
                    {apt.patient_friendly_summary ? (
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" /> Patient-Friendly Doctor Summary & Care Plan
                        </h4>
                        <p className="text-xs text-slate-200 leading-relaxed">{apt.patient_friendly_summary}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No post-visit notes released for this appointment.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* MEDICATION REMINDERS TAB */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'medications' && user && (
            <MedicationRemindersCard patientId={user.id} />
          )}

        </div>

      </div>
    </div>
  );
};
