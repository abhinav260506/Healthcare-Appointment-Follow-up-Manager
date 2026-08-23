import React, { useState, useEffect } from 'react';
import { Appointment } from '../../types';
import { appointmentApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Calendar, RefreshCw, Sparkles, Stethoscope, UserX, Trophy, AlertTriangle, AlertCircle } from 'lucide-react';
import { PreVisitBriefModal } from './PreVisitBriefModal';
import { VisitConsultationModal } from './VisitConsultationModal';
import { DoctorLeaveRequestModal } from './DoctorLeaveRequestModal';

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Controls
  const [selectedForBrief, setSelectedForBrief] = useState<Appointment | null>(null);
  const [selectedForConsultation, setSelectedForConsultation] = useState<Appointment | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);

  useEffect(() => {
    if (user?.doctorId || user?.id) {
      fetchAgenda();
    }
  }, [user, selectedDate]);

  const fetchAgenda = async () => {
    const targetId = user?.doctorId || user?.id;
    if (!targetId) return;
    setLoading(true);
    try {
      const data = await appointmentApi.getDoctorAgenda(targetId, selectedDate || undefined);
      setAppointments(data);
    } catch (err) {
      console.error('Error fetching doctor agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyConfig = (level?: string) => {
    switch (level) {
      case 'Critical': return {
        badgeCls: 'badge-critical',
        borderCls: 'border-l-4 border-l-red-500',
        icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
        rankCls: 'bg-red-500/20 text-red-300 border-red-500/40'
      };
      case 'High': return {
        badgeCls: 'badge-high',
        borderCls: 'border-l-4 border-l-orange-500',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />,
        rankCls: 'bg-orange-500/20 text-orange-300 border-orange-500/40'
      };
      case 'Medium': return {
        badgeCls: 'badge-medium',
        borderCls: 'border-l-4 border-l-amber-500',
        icon: <Trophy className="w-3.5 h-3.5 text-amber-400" />,
        rankCls: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      };
      default: return {
        badgeCls: 'badge-low',
        borderCls: 'border-l-4 border-l-emerald-600',
        icon: <Trophy className="w-3.5 h-3.5 text-emerald-400" />,
        rankCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      };
    }
  };

  // Only active booked appointments for priority queue numbering
  const bookedQueue = appointments.filter(a => a.status === 'booked' || a.status === 'rescheduled');

  return (
    <div className="space-y-6">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-cyan-400" />
            Doctor Clinical Agenda & Patient Queue
          </h2>
          <p className="text-slate-400 text-sm">
            Patients sorted by AI severity rating — Critical & High priority patients shown first, regardless of booking time.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAgenda}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all"
            title="Refresh Appointment Agenda"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {(user?.doctorId || user?.id) && (
            <button
              onClick={() => setShowLeaveModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <UserX className="w-4 h-4" />
              <span>Manage Leave</span>
            </button>
          )}

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          {selectedDate && (
            <button onClick={() => setSelectedDate('')} className="text-xs text-slate-400 hover:text-white underline">
              All Dates
            </button>
          )}
        </div>
      </div>

      {/* Priority Queue Header */}
      {bookedQueue.length > 0 && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Priority Queue Active:</strong> {bookedQueue.length} patient{bookedQueue.length !== 1 ? 's' : ''} in queue.
            Critical & High severity cases are shown first, regardless of booking time.
          </span>
        </div>
      )}

      {/* Appointment Queue Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading daily agenda...</div>
      ) : appointments.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto opacity-40" />
          <p className="text-sm">No scheduled patient visits found for this doctor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((apt, idx) => {
            const cfg = getUrgencyConfig(apt.urgency_level);
            const queuePosition = bookedQueue.findIndex(a => a.id === apt.id);
            const isActive = apt.status === 'booked' || apt.status === 'rescheduled';

            return (
              <div key={apt.id} className={`glass-panel rounded-2xl p-6 space-y-4 glass-panel-hover ${cfg.borderCls}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-3">
                    {/* Priority Queue Position Badge */}
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                        isActive && queuePosition === 0
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-2 ring-amber-500/30'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}>
                        {isActive ? `#${queuePosition + 1}` : apt.patient_name?.charAt(0) || 'P'}
                      </div>
                      {isActive && queuePosition === 0 && (
                        <span className="text-[9px] text-amber-400 font-bold mt-0.5">NEXT</span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-white text-base">{apt.patient_name}</h3>
                      <p className="text-xs text-slate-400">{apt.date} at {apt.start_time} — {apt.end_time}</p>
                      {apt.phone && <p className="text-[11px] text-slate-500">📱 {apt.phone}</p>}
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    {/* Severity Score */}
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border flex items-center gap-1 ${cfg.rankCls}`}>
                      {cfg.icon} Severity {apt.severity || '?'}/10
                    </span>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${cfg.badgeCls}`}>
                      {apt.urgency_level || 'Medium'} Priority
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      apt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : apt.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                    } capitalize`}>
                      {apt.status}
                    </span>
                  </div>
                </div>

                {/* Pre-Visit AI Chief Complaint Summary */}
                {apt.chief_complaint && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                    <div className="text-cyan-400 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> AI Triage Summary:
                    </div>
                    <p className="text-slate-300 font-medium">{apt.chief_complaint}</p>
                    {apt.symptoms && (
                      <p className="text-slate-500 text-[11px]">Reported: {apt.symptoms}</p>
                    )}
                  </div>
                )}

                {/* Doctor Actions */}
                <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedForBrief(apt)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Full AI Brief & History</span>
                  </button>

                  {isActive && (
                    <button
                      onClick={() => setSelectedForConsultation(apt)}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Start Visit & Post Notes</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {selectedForBrief && (
        <PreVisitBriefModal
          appointment={selectedForBrief}
          onClose={() => setSelectedForBrief(null)}
          onStartVisit={
            (selectedForBrief.status === 'booked' || selectedForBrief.status === 'rescheduled')
              ? () => setSelectedForConsultation(selectedForBrief)
              : undefined
          }
        />
      )}

      {selectedForConsultation && (
        <VisitConsultationModal
          appointment={selectedForConsultation}
          onClose={() => setSelectedForConsultation(null)}
          onConsultationComplete={() => {
            setSelectedForConsultation(null);
            fetchAgenda();
          }}
        />
      )}

      {showLeaveModal && (user?.doctorId || user?.id) && (
        <DoctorLeaveRequestModal
          doctorId={user.doctorId || user.id}
          doctorName={user.name}
          onClose={() => setShowLeaveModal(false)}
        />
      )}
    </div>
  );
};
