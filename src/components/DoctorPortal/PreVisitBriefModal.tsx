import React, { useState, useEffect } from 'react';
import { Appointment } from '../../types';
import { Sparkles, X, AlertCircle, HelpCircle, FileText, User, ShieldAlert, Pill, Heart, Calendar, ChevronDown, ChevronUp, History, Clock } from 'lucide-react';

interface PreVisitBriefModalProps {
  appointment: Appointment;
  onClose: () => void;
  onStartVisit?: () => void;
}

export const PreVisitBriefModal: React.FC<PreVisitBriefModalProps> = ({ appointment, onClose, onStartVisit }) => {
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const getUrgencyBadge = (level?: string) => {
    switch (level) {
      case 'Critical': return 'badge-critical';
      case 'High': return 'badge-high';
      case 'Medium': return 'badge-medium';
      default: return 'badge-low';
    }
  };

  // Parse extended AI analysis from suggested_questions field
  const parseExtendedData = () => {
    try {
      const raw = appointment.suggested_questions;
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // New format: has questions key
      if (parsed.questions) return parsed;
      // Old format: array of questions
      if (Array.isArray(parsed)) return { questions: parsed };
      return parsed;
    } catch {
      return null;
    }
  };

  const extData = parseExtendedData();
  const questions = extData?.questions || (Array.isArray(appointment.suggested_questions) ? appointment.suggested_questions : []);

  const fetchPatientHistory = async () => {
    if (patientHistory.length > 0) { setShowHistory(!showHistory); return; }
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/appointments/patient-history/${appointment.patient_id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setPatientHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch patient history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const urgencyColors: Record<string, string> = {
    Critical: 'border-red-500/40 bg-red-500/5',
    High: 'border-orange-500/40 bg-orange-500/5',
    Medium: 'border-amber-500/40 bg-amber-500/5',
    Low: 'border-emerald-500/40 bg-emerald-500/5'
  };

  const borderColor = urgencyColors[appointment.urgency_level || 'Medium'] || urgencyColors.Medium;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className={`glass-panel w-full max-w-2xl rounded-2xl p-6 sm:p-8 space-y-5 relative border shadow-2xl ${borderColor}`}>

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
              {appointment.patient_name?.charAt(0) || 'P'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{appointment.patient_name}</h3>
              <p className="text-xs text-slate-400">{appointment.date} at {appointment.start_time} — {appointment.end_time}</p>
              {appointment.phone && <p className="text-xs text-slate-500">📱 {appointment.phone}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getUrgencyBadge(appointment.urgency_level)}`}>
              ⚡ {appointment.urgency_level || 'Medium'} Priority
            </span>
            <span className="text-xs text-slate-400">Severity: <strong className="text-cyan-400">{appointment.severity || 5}/10</strong></span>
          </div>
        </div>

        {/* Symptom Overview */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> AI Clinical Triage Analysis
          </h4>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            {appointment.chief_complaint || appointment.symptoms}
          </p>
          <div className="text-xs text-slate-400 flex items-center gap-4 pt-2 border-t border-slate-800">
            <span>Reported Symptoms: <strong className="text-slate-200">{appointment.symptoms || 'See above'}</strong></span>
            <span>Duration: <strong className="text-white">{appointment.duration || 'N/A'}</strong></span>
          </div>
        </div>

        {/* Extended AI Analysis Grid */}
        {extData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {extData.symptom_cause && (
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <h5 className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1"><Heart className="w-3 h-3" /> Likely Cause</h5>
                <p className="text-xs text-slate-300 leading-relaxed">{extData.symptom_cause}</p>
              </div>
            )}
            {extData.initial_care && (
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <h5 className="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Immediate Care</h5>
                <p className="text-xs text-slate-300 leading-relaxed">{extData.initial_care}</p>
              </div>
            )}
            {extData.prevention_tips && (
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <h5 className="text-[11px] font-bold text-blue-400 uppercase flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Prevention Tips</h5>
                <p className="text-xs text-slate-300 leading-relaxed">{extData.prevention_tips}</p>
              </div>
            )}
            {extData.medicines_to_avoid && (
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <h5 className="text-[11px] font-bold text-red-400 uppercase flex items-center gap-1"><Pill className="w-3 h-3" /> Medicines to Avoid</h5>
                <p className="text-xs text-slate-300 leading-relaxed">{extData.medicines_to_avoid}</p>
              </div>
            )}
          </div>
        )}

        {/* Red Flags */}
        {extData?.red_flags && (
          <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/30 space-y-1.5">
            <h5 className="text-[11px] font-bold text-red-400 uppercase flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Emergency Red Flags</h5>
            <p className="text-xs text-red-300 leading-relaxed">{extData.red_flags}</p>
          </div>
        )}

        {/* Suggested Next Visit */}
        {extData?.suggested_next_visit && (
          <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex items-center gap-2 text-xs">
            <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-300"><strong className="text-cyan-400">Suggested Next Visit:</strong> {extData.suggested_next_visit}</span>
          </div>
        )}

        {/* Medical History */}
        {appointment.medical_history && (
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Pre-existing Conditions & Allergies:</h4>
            <p className="text-xs text-slate-300">{appointment.medical_history}</p>
          </div>
        )}

        {/* Doctor Consultation Questions */}
        {questions.length > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-850 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" /> Suggested Consultation Questions:
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
              {questions.map((q: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{q}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Patient Past Clinical History */}
        <div className="border-t border-slate-800 pt-4">
          <button
            onClick={fetchPatientHistory}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-all"
          >
            <span className="flex items-center gap-2"><History className="w-4 h-4 text-cyan-400" /> View Past Clinical History ({patientHistory.length || '?'} records)</span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
              {historyLoading ? (
                <div className="text-center py-4 text-xs text-slate-400">Loading clinical history...</div>
              ) : patientHistory.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No past completed visits found for this patient.
                </div>
              ) : (
                patientHistory.map((h: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{h.date} — {h.specialisation}</span>
                      <span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {h.start_time}</span>
                    </div>
                    {h.symptoms && <p className="text-slate-400"><strong>Symptoms:</strong> {h.symptoms}</p>}
                    {h.diagnosis && <p className="text-emerald-300"><strong>Diagnosis:</strong> {h.diagnosis}</p>}
                    {h.clinical_notes && <p className="text-slate-300">{h.clinical_notes}</p>}
                    {h.patient_friendly_summary && (
                      <p className="text-cyan-300 italic text-[11px]">{h.patient_friendly_summary}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition-all">
            Close Brief
          </button>
          {onStartVisit && (
            <button
              onClick={() => { onClose(); onStartVisit(); }}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Start Visit & Enter Notes →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
