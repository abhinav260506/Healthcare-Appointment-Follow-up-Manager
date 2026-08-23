import React, { useState, useEffect } from 'react';
import { Doctor, TimeSlot, PreVisitSummary } from '../../types';
import { appointmentApi, doctorApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, X, Sparkles, FileText, ExternalLink, Download, Stethoscope } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BookingModalProps {
  doctor?: Doctor | null;
  onClose: () => void;
  onBookingComplete: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ doctor: initialDoctor, onClose, onBookingComplete }) => {
  const { user } = useAuth();

  // Doctors list for doctor selection if initialDoctor is not provided
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(initialDoctor || null);

  // Wizard Step (1: Select Doctor & Slot, 2: Symptoms, 3: AI Analysis Preview & Confirm, 4: Success)
  const [step, setStep] = useState<number>(1);

  // Step 1: Date & Time Slot
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isOnLeave, setIsOnLeave] = useState<boolean>(false);
  const [leaveReason, setLeaveReason] = useState<string | undefined>('');
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Step 2: Symptom Form
  const [symptoms, setSymptoms] = useState<string>('Mild chest tightness on exertion for past 2 days, worse in morning.');
  const [duration, setDuration] = useState<string>('2 days');
  const [severity, setSeverity] = useState<number>(6);
  const [medicalHistory, setMedicalHistory] = useState<string>('Hypertension, Mild Asthma');

  // Step 3 & 4: Submission & Result
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [analyzingSymptoms, setAnalyzingSymptoms] = useState<boolean>(false);
  const [preVisitSummary, setPreVisitSummary] = useState<PreVisitSummary | null>(null);
  const [bookedAppointmentId, setBookedAppointmentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAnalyzeAndPreview = async () => {
    if (!symptoms.trim()) return;
    setAnalyzingSymptoms(true);
    setErrorMsg(null);
    try {
      const analysis = await appointmentApi.analyzeSymptoms({
        symptoms,
        duration,
        severity
      });
      setPreVisitSummary(analysis);
      setStep(3);
    } catch (err: any) {
      console.warn('Real-time symptom analysis fallback:', err.message);
      setStep(3);
    } finally {
      setAnalyzingSymptoms(false);
    }
  };

  useEffect(() => {
    doctorApi.getAll().then((docs) => {
      setAllDoctors(docs);
      if (!selectedDoctor && docs.length > 0) {
        setSelectedDoctor(docs[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
      fetchSlots();
    }
  }, [selectedDate, selectedDoctor?.id]);

  const fetchSlots = async () => {
    if (!selectedDoctor) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const res = await appointmentApi.getAvailableSlots(selectedDoctor.id, selectedDate);
      setIsOnLeave(res.isOnLeave);
      setLeaveReason(res.leaveReason);
      setSlots(res.slots || []);
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedSlot || !selectedDoctor) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await appointmentApi.book({
        patientId: user.id,
        doctorId: selectedDoctor.id,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        symptoms,
        duration,
        severity,
        medicalHistory
      });

      setPreVisitSummary(res.preVisitSummary);
      setBookedAppointmentId(res.appointment.id);
      setStep(4); // Success Step

      // Trigger Celebration Confetti!
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrorMsg('DOUBLE BOOKING PREVENTED: This appointment slot was just reserved by another patient. Please choose a different available slot.');
        setStep(1);
        fetchSlots();
      } else {
        setErrorMsg(err.response?.data?.error || err.message || 'Failed to complete booking');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getUrgencyBadge = (level?: string) => {
    switch (level) {
      case 'Critical': return 'badge-critical';
      case 'High': return 'badge-high';
      case 'Medium': return 'badge-medium';
      default: return 'badge-low';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 sm:p-8 space-y-6 relative border border-slate-700/80 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Banner */}
        <div className="flex items-center space-x-4 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/20">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Book Doctor Consultation</h3>
            <p className="text-cyan-400 text-xs font-semibold">Select specialist, slot, and fill pre-visit symptoms</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-2">
          <span className={step >= 1 ? 'text-cyan-400 font-bold' : ''}>1. Doctor & Time Slot</span>
          <span className="text-slate-600">→</span>
          <span className={step >= 2 ? 'text-cyan-400 font-bold' : ''}>2. Symptom Details</span>
          <span className="text-slate-600">→</span>
          <span className={step >= 3 ? 'text-cyan-400 font-bold' : ''}>3. AI Brief & Confirm</span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: Select Doctor, Date & Time Slot */}
        {/* ------------------------------------------------------------- */}
        {step === 1 && (
          <div className="space-y-5">
            
            {/* Doctor Picker Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-cyan-400" />
                Select Specialist Doctor *
              </label>
              <select
                value={selectedDoctor?.id || ''}
                onChange={(e) => {
                  const doc = allDoctors.find((d) => d.id === e.target.value);
                  if (doc) setSelectedDoctor(doc);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {allDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialisation} ({d.slot_duration} min slots)
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-400" />
                Select Appointment Date
              </label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Available Time Slots */}
            {isOnLeave ? (
              <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <h4 className="font-bold text-amber-300">Doctor is Away on Leave</h4>
                <p className="text-xs text-slate-300">{leaveReason || 'Please select another date or doctor for booking.'}</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Available Consultation Slots ({selectedDoctor?.slot_duration || 30} min)
                  </span>
                  {selectedSlot && <span className="text-cyan-400 font-bold">Selected: {selectedSlot.startTime}</span>}
                </label>

                {loadingSlots ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Computing available slots...</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {slots.map((s, idx) => (
                      <button
                        key={idx}
                        disabled={!s.available}
                        onClick={() => setSelectedSlot(s)}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                          !s.available
                            ? s.isBreak
                              ? 'bg-slate-900/40 text-slate-600 border-slate-800 line-through cursor-not-allowed'
                              : 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                            : selectedSlot?.startTime === s.startTime
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-lg shadow-cyan-500/20'
                            : 'bg-slate-800/80 text-slate-200 border-slate-700/80 hover:border-cyan-500/50'
                        }`}
                      >
                        {s.startTime}
                        {s.isBooked && <span className="block text-[10px] text-red-400">Booked</span>}
                        {s.isBreak && <span className="block text-[10px] text-amber-500">Break</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end pt-4 border-t border-slate-800">
              <button
                disabled={!selectedSlot || isOnLeave}
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all text-sm flex items-center gap-2"
              >
                <span>Next: Symptom Questionnaire</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: Symptom Form */}
        {/* ------------------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Describe Your Symptoms / Chief Complaint *
              </label>
              <textarea
                rows={3}
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe what you are experiencing, location, pain type..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Duration</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 2 days, 3 weeks"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Severity Scale: <span className="text-cyan-400 font-bold">{severity}/10</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 mt-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Medical History & Allergies</label>
              <input
                type="text"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Pre-existing conditions, active medications, allergies..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <button
                disabled={!symptoms.trim() || analyzingSymptoms}
                onClick={handleAnalyzeAndPreview}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all text-sm flex items-center gap-2"
              >
                {analyzingSymptoms ? (
                  <span>Analyzing Symptoms with AI...</span>
                ) : (
                  <>
                    <span>Analyze Symptoms & Preview Brief</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: AI Pre-Visit Summary Preview & Final Booking */}
        {/* ------------------------------------------------------------- */}
        {step === 3 && (
          <div className="space-y-4">
            {/* AI Triage Preview Header */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> AI Clinical Triage & Symptom Assessment
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-cyan-300">
                    Severity: {severity}/10
                  </span>
                  <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${getUrgencyBadge(preVisitSummary?.urgency_level || (severity >= 8 ? 'Critical' : severity >= 6 ? 'High' : severity >= 4 ? 'Medium' : 'Low'))}`}>
                    {preVisitSummary?.urgency_level?.toUpperCase() || (severity >= 8 ? 'CRITICAL' : severity >= 6 ? 'HIGH' : severity >= 4 ? 'MEDIUM' : 'LOW')} URGENCY
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-200">
                <strong>Chief Complaint:</strong> {preVisitSummary?.chief_complaint || `Patient reports ${symptoms} (Duration: ${duration}, Severity: ${severity}/10).`}
              </div>
            </div>

            {/* Dynamic Symptom-Specific Care & Doctor Focus */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-1.5">
                <div className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Immediate Home Care Notice:
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {preVisitSummary?.initial_care || 'Rest adequately in a comfortable position, stay hydrated, and monitor symptoms.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/30 space-y-1.5">
                <div className="text-blue-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Prevention & Recovery Guidance:
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {preVisitSummary?.prevention_tips || 'Maintain balanced nutrition, stay hydrated, and avoid physical or environmental stressors.'}
                </p>
              </div>
            </div>

            {/* Doctor Clinical Focus Questions */}
            {preVisitSummary?.suggested_questions && preVisitSummary.suggested_questions.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> What the Doctor Will Check During Your Visit:
                </div>
                <ul className="text-slate-300 space-y-1 list-disc pl-4">
                  {preVisitSummary.suggested_questions.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Red Flags Alert if Present */}
            {preVisitSummary?.red_flags && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-red-400">Emergency Red Flags: </strong>
                  {preVisitSummary.red_flags}
                </div>
              </div>
            )}

            {/* Slot & Doctor Lock Summary */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span>Doctor: <strong className="text-white">{selectedDoctor?.name}</strong> ({selectedDoctor?.specialisation})</span>
                <span className="block sm:inline sm:ml-3 text-cyan-400 font-medium">Date: {selectedDate} at {selectedSlot?.startTime}</span>
              </div>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Slot Ready to Book
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <button
                disabled={submitting}
                onClick={handleConfirmBooking}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-sm flex items-center gap-2"
              >
                {submitting ? (
                  <span>Saving & Confirming Appointment...</span>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Confirm & Book Appointment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 4: Success Confirmation & AI Symptom Analysis Results */}
        {/* ------------------------------------------------------------- */}
        {step === 4 && (
          <div className="py-2 space-y-5 text-left">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-2xl">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-white">Appointment Successfully Booked!</h3>
              <p className="text-xs text-slate-300">
                Your consultation with <strong>{selectedDoctor?.name}</strong> is confirmed for <strong>{selectedDate} at {selectedSlot?.startTime}</strong>.
              </p>
            </div>

            {/* Rich AI Symptom & Severity Analysis Result */}
            {preVisitSummary && (
              <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> AI Symptom Analysis & Severity Triage
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-950 border border-slate-700 text-cyan-300">
                      Severity: {severity}/10
                    </span>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${getUrgencyBadge(preVisitSummary.urgency_level)}`}>
                      {preVisitSummary.urgency_level?.toUpperCase() || 'MEDIUM'} URGENCY
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-200 leading-relaxed font-medium">
                  <strong>AI Chief Complaint:</strong> {preVisitSummary.chief_complaint}
                </div>

                {/* Extended Analysis Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
                  {preVisitSummary.initial_care && (
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                      <div className="font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Immediate Home Care:
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{preVisitSummary.initial_care}</p>
                    </div>
                  )}

                  {preVisitSummary.prevention_tips && (
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-1">
                      <div className="font-bold text-blue-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Prevention Tips:
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{preVisitSummary.prevention_tips}</p>
                    </div>
                  )}

                  {preVisitSummary.symptom_cause && (
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
                      <div className="font-bold text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Likely Cause:
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{preVisitSummary.symptom_cause}</p>
                    </div>
                  )}

                  {preVisitSummary.medicines_to_avoid && (
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 space-y-1">
                      <div className="font-bold text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Medicines to Avoid:
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{preVisitSummary.medicines_to_avoid}</p>
                    </div>
                  )}
                </div>

                {preVisitSummary.red_flags && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-red-400">Emergency Red Flags: </strong>
                      {preVisitSummary.red_flags}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Google Calendar & .ics Download Action Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Calendar Integrations & Email Notice</h4>
              <p className="text-xs text-slate-400">
                A confirmation email with details has been sent. You can also add this consultation to your calendar:
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Medical Appointment with ${selectedDoctor?.name}`)}&dates=${selectedDate.replace(/-/g, '')}T${selectedSlot?.startTime.replace(':', '')}00/${selectedDate.replace(/-/g, '')}T${selectedSlot?.endTime.replace(':', '')}00`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>+ Add to Google Calendar</span>
                </a>

                {bookedAppointmentId && (
                  <a
                    href={`/api/appointments/${bookedAppointmentId}/calendar.ics`}
                    download
                    className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>Download .ics iCalendar</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => { onClose(); onBookingComplete(); }}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                Done & Go to My Patient Dashboard →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
