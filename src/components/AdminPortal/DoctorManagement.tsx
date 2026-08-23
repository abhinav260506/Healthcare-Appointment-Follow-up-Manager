import React, { useState, useEffect } from 'react';
import { Doctor } from '../../types';
import { doctorApi } from '../../services/api';
import { Plus, Clock, Calendar, Stethoscope, UserCheck, AlertCircle, Edit2 } from 'lucide-react';

export const DoctorManagement: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [specialisation, setSpecialisation] = useState('Cardiology');
  const [workingStart, setWorkingStart] = useState('09:00');
  const [workingEnd, setWorkingEnd] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState('30');
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const data = await doctorApi.getAll();
      setDoctors(data);
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result: any = await doctorApi.create({
        name,
        email,
        specialisation,
        workingStart,
        workingEnd,
        slotDuration: parseInt(slotDuration, 10),
        breakStart,
        breakEnd
      });
      setShowAddModal(false);
      resetForm();
      fetchDoctors();
      // Show the temp password to admin
      if (result.tempPassword) {
        setSuccessMessage({ name: result.name, email: result.email, tempPassword: result.tempPassword });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create doctor. Please try again.');
    }
  };

  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    setError('');
    try {
      await doctorApi.update(editingDoctor.id, {
        specialisation,
        workingStart,
        workingEnd,
        slotDuration: parseInt(slotDuration, 10),
        breakStart,
        breakEnd,
        isActive: editingDoctor.is_active
      });
      setEditingDoctor(null);
      resetForm();
      fetchDoctors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update doctor');
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setSpecialisation('Cardiology');
    setWorkingStart('09:00');
    setWorkingEnd('17:00');
    setSlotDuration('30');
    setBreakStart('13:00');
    setBreakEnd('14:00');
  };

  const startEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setName(doc.name);
    setEmail(doc.email);
    setSpecialisation(doc.specialisation);
    setWorkingStart(doc.working_start);
    setWorkingEnd(doc.working_end);
    setSlotDuration(String(doc.slot_duration));
    setBreakStart(doc.break_start || '13:00');
    setBreakEnd(doc.break_end || '14:00');
  };

  return (
    <div className="space-y-6">
      {/* Temp Password Success Banner */}
      {successMessage && (
        <div className="glass-panel rounded-2xl p-5 border border-emerald-500/40 bg-emerald-500/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-emerald-400 font-semibold flex items-center gap-2 mb-2">
                <UserCheck className="w-5 h-5" /> Doctor Profile Created Successfully!
              </h4>
              <p className="text-slate-300 text-sm mb-3">Share these login credentials with <strong className="text-white">{successMessage.name}</strong>:</p>
              <div className="bg-slate-900 rounded-xl p-4 space-y-2 font-mono text-sm border border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-cyan-300">{successMessage.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Temp Password:</span>
                  <span className="text-amber-300 font-bold tracking-widest">{successMessage.tempPassword}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">⚠️ The doctor must set up TOTP MFA on first login. Save this password — it won't be shown again.</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-cyan-400" />
            Doctor Profile & Schedule Management
          </h2>
          <p className="text-slate-400 text-sm">
            Administer doctor working hours, slot durations (15/30/45/60m), and availability.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Doctor Profile</span>
        </button>
      </div>

      {/* Doctor Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading doctor profiles...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doc) => (
            <div key={doc.id} className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                    {doc.name.charAt(4) || 'D'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{doc.name}</h3>
                    <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {doc.specialisation}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => startEdit(doc)}
                  className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                  title="Edit Doctor Settings"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-4 h-4 text-cyan-400" /> Working Hours:</span>
                  <span className="font-medium">{doc.working_start} - {doc.working_end}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-400" /> Slot Duration:</span>
                  <span className="font-medium bg-slate-800 px-2 py-0.5 rounded text-cyan-300">{doc.slot_duration} mins</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> Break Hours:</span>
                  <span className="font-medium">{doc.break_start || '13:00'} - {doc.break_end || '14:00'}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Contact: {doc.email}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" /> Active
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Doctor Modal */}
      {(showAddModal || editingDoctor) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-cyan-400" />
              {editingDoctor ? `Edit ${editingDoctor.name}` : 'Add New Doctor Profile'}
            </h3>

            <form onSubmit={editingDoctor ? handleUpdateDoctor : handleCreateDoctor} className="space-y-4">
              {!editingDoctor && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Doctor Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Sarah Jenkins"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="sarah.jenkins@clinic.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Medical Specialisation</label>
                <select
                  value={specialisation}
                  onChange={(e) => setSpecialisation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Psychiatry">Psychiatry</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Work Start Time</label>
                  <input
                    type="time"
                    value={workingStart}
                    onChange={(e) => setWorkingStart(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Work End Time</label>
                  <input
                    type="time"
                    value={workingEnd}
                    onChange={(e) => setWorkingEnd(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Slot Duration</label>
                  <select
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Break Start Time</label>
                  <input
                    type="time"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                {error && (
                  <div className="flex-1 flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingDoctor(null); setError(''); }}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl shadow-md transition-all text-sm"
                >
                  {editingDoctor ? 'Save Changes' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
