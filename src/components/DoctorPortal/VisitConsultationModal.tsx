import React, { useState } from 'react';
import { Appointment, PrescriptionItem, PostVisitSummary } from '../../types';
import { consultationApi } from '../../services/api';
import { Stethoscope, X, Plus, Trash2, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';

interface VisitConsultationModalProps {
  appointment: Appointment;
  onClose: () => void;
  onConsultationComplete: () => void;
}

export const VisitConsultationModal: React.FC<VisitConsultationModalProps> = ({
  appointment,
  onClose,
  onConsultationComplete
}) => {
  const [diagnosis, setDiagnosis] = useState<string>('Stage 1 Essential Hypertension & Mild Stress-Induced Angina');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    'Patient presented with exertional chest tightness. BP elevated at 138/88 mmHg. EKG shows normal sinus rhythm. Advised lifestyle modification and low sodium diet.'
  );

  // Vitals
  const [bp, setBp] = useState<string>('138/88 mmHg');
  const [hr, setHr] = useState<string>('74 bpm');
  const [temp, setTemp] = useState<string>('98.6 °F');
  const [spo2, setSpo2] = useState<string>('99%');

  // Prescriptions List
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([
    { drug: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily in the morning (08:00 AM)', duration: '30 days' },
    { drug: 'Lisinopril 10mg', dosage: '1 tablet', frequency: 'Once daily in the evening (08:00 PM)', duration: '30 days' }
  ]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [generatedPostSummary, setGeneratedPostSummary] = useState<PostVisitSummary | null>(null);

  const addPrescriptionRow = () => {
    setPrescriptions([
      ...prescriptions,
      { drug: '', dosage: '1 tablet', frequency: 'Twice daily (08:00 AM & 08:00 PM)', duration: '7 days' }
    ]);
  };

  const removePrescriptionRow = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const updatePrescription = (index: number, field: keyof PrescriptionItem, val: string) => {
    const updated = [...prescriptions];
    updated[index][field] = val;
    setPrescriptions(updated);
  };

  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await consultationApi.complete({
        appointmentId: appointment.id,
        clinicalNotes,
        diagnosis,
        vitals: { bp, hr, temp, spo2 },
        prescriptions
      });

      setGeneratedPostSummary(res.postVisitSummary);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to complete visit consultation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="glass-panel w-full max-w-3xl rounded-2xl p-6 sm:p-8 space-y-6 relative border border-slate-700 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-cyan-400" />
            Complete Patient Visit Consultation
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Patient: <strong>{appointment.patient_name}</strong> • Visit Date: {appointment.date} at {appointment.start_time}
          </p>
        </div>

        {/* Successful Summary Result Card */}
        {generatedPostSummary ? (
          <div className="space-y-6 text-left py-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-300">Visit Consultation Completed & Saved to DB</h4>
                <p className="text-xs text-slate-300 mt-1">
                  AI has converted your clinical notes into a patient-friendly summary and auto-populated the patient's daily medication schedule.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> AI Patient-Friendly Post-Visit Summary:
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {generatedPostSummary.patient_friendly_summary}
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => { onClose(); onConsultationComplete(); }}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs shadow-md"
              >
                Return to Agenda Queue
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitConsultation} className="space-y-6">
            {/* Diagnosis & Notes */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Diagnosis *</label>
                <input
                  type="text"
                  required
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Stage 1 Essential Hypertension"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Clinical Observations & Treatment Notes *</label>
                <textarea
                  rows={3}
                  required
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Enter medical notes, examination findings, diet advice..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Vitals Grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Patient Vitals</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400">Blood Pressure</span>
                  <input
                    type="text"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Heart Rate</span>
                  <input
                    type="text"
                    value={hr}
                    onChange={(e) => setHr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Temperature</span>
                  <input
                    type="text"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">SpO2 Oxygen</span>
                  <input
                    type="text"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Prescriptions Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Rx Prescriptions Builder</label>
                <button
                  type="button"
                  onClick={addPrescriptionRow}
                  className="px-3 py-1 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Drug
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {prescriptions.map((rx, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-12 gap-2 items-center text-xs">
                    <input
                      type="text"
                      placeholder="Drug Name (e.g. Amoxicillin 500mg)"
                      value={rx.drug}
                      onChange={(e) => updatePrescription(idx, 'drug', e.target.value)}
                      className="col-span-4 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Dose (1 tab)"
                      value={rx.dosage}
                      onChange={(e) => updatePrescription(idx, 'dosage', e.target.value)}
                      className="col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Frequency (2x daily)"
                      value={rx.frequency}
                      onChange={(e) => updatePrescription(idx, 'frequency', e.target.value)}
                      className="col-span-4 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removePrescriptionRow(idx)}
                      className="col-span-2 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !diagnosis || !clinicalNotes}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-sm flex items-center gap-2"
              >
                {submitting ? (
                  <span>Generating AI Post-Visit Summary...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Complete Visit & Generate AI Summary</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
