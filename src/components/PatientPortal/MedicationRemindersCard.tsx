import React, { useState, useEffect } from 'react';
import { MedicationReminder } from '../../types';
import { consultationApi } from '../../services/api';
import { Pill, CheckCircle2, Clock, Bell, Volume2, AlertCircle } from 'lucide-react';

interface MedicationRemindersCardProps {
  patientId: string;
}

export const MedicationRemindersCard: React.FC<MedicationRemindersCardProps> = ({ patientId }) => {
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchReminders();
  }, [patientId]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const data = await consultationApi.getMedicationReminders(patientId);
      setReminders(data);
    } catch (err) {
      console.error('Error loading medication reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (reminderId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'taken' ? 'pending' : 'taken';
    try {
      await consultationApi.updateMedicationStatus(reminderId, nextStatus);
      fetchReminders();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const playTestSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Pill className="w-5 h-5 text-emerald-400" />
            Interactive Medication Schedule & Compliance Tracker
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated reminders generated from your doctor's prescriptions. Mark doses as taken to log compliance.
          </p>
        </div>

        <button
          onClick={playTestSound}
          title="Test Notification Sound Alert"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
        >
          <Volume2 className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Test Sound Alarm</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Loading medication routine...</div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          No active medication reminders scheduled. Prescriptions from doctor consultations will automatically populate here.
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((rem) => (
            <div
              key={rem.id}
              className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                rem.status === 'taken'
                  ? 'bg-slate-900/40 border-slate-800 opacity-60'
                  : 'bg-slate-900 border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              <div className="flex items-center space-x-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                    rem.status === 'taken'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold text-sm ${rem.status === 'taken' ? 'line-through text-slate-400' : 'text-white'}`}>
                      {rem.medication_name}
                    </h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-cyan-300">
                      {rem.dosage}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span>Scheduled: <strong>{rem.scheduled_time}</strong></span>
                    <span>• {rem.frequency}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleToggleStatus(rem.id, rem.status)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  rem.status === 'taken'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{rem.status === 'taken' ? 'Taken ✓' : 'Mark Taken'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
