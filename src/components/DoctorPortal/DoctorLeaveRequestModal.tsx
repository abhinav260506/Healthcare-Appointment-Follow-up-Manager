import React, { useState, useEffect } from 'react';
import { LeaveRequest } from '../../types';
import { doctorApi } from '../../services/api';
import { Calendar, UserX, X, CheckCircle, AlertTriangle, Clock, XCircle, Edit2, Trash2, Save } from 'lucide-react';

interface DoctorLeaveRequestModalProps {
  doctorId: string;
  doctorName: string;
  onClose: () => void;
}

export const DoctorLeaveRequestModal: React.FC<DoctorLeaveRequestModalProps> = ({
  doctorId,
  doctorName,
  onClose
}) => {
  const [fromDate, setFromDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFrom, setEditFrom] = useState<string>('');
  const [editTo, setEditTo] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    fetchMyRequests();
  }, [doctorId]);

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const data = await doctorApi.getLeaveRequests(doctorId);
      setMyRequests(data);
    } catch (err) {
      console.error('Failed to load doctor leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Please enter a reason for your leave.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await doctorApi.submitLeaveRequest(doctorId, fromDate, toDate, reason);
      setReason('');
      setSuccessMsg('Leave request submitted successfully! Awaiting admin approval.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchMyRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit leave request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (req: LeaveRequest) => {
    setEditingId(req.id);
    setEditFrom(req.from_date);
    setEditTo(req.to_date);
    setEditReason(req.reason);
    setError('');
  };

  const handleSaveEdit = async (req: LeaveRequest) => {
    setSavingEdit(true);
    setError('');
    try {
      // Cancel old request then re-submit with updated dates/reason
      await doctorApi.cancelLeaveRequest(req.id);
      await doctorApi.submitLeaveRequest(doctorId, editFrom, editTo, editReason);
      setEditingId(null);
      setSuccessMsg('Leave request updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMyRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update leave request.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancel = async (req: LeaveRequest) => {
    if (!window.confirm(`Cancel this leave request (${req.from_date} → ${req.to_date})?`)) return;
    try {
      await doctorApi.cancelLeaveRequest(req.id);
      setSuccessMsg('Leave request cancelled.');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMyRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel leave request.');
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' };
    if (status === 'rejected') return { cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' };
    return { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <Clock className="w-3 h-3" />, label: 'Pending' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 sm:p-8 space-y-6 relative border border-slate-700 shadow-2xl">

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
            <UserX className="w-6 h-6 text-amber-400" />
            Leave Request Management
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Submit, modify, or cancel leave requests. Admin will review and approve/reject.
          </p>
        </div>

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* New Leave Request Form */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Submit New Leave Request
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">From Date *</label>
                <input
                  type="date"
                  required
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">To Date *</label>
                <input
                  type="date"
                  required
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Reason for Leave *</label>
              <input
                type="text"
                required
                placeholder="e.g. Attending Cardiology Summit / Personal Vacation / Medical Emergency"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md text-xs transition-all flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting...' : '+ Submit Leave Request to Admin'}
            </button>
          </form>
        </div>

        {/* My Leave Requests Log */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>My Leave Requests</span>
            <span className="text-slate-500 normal-case font-normal">
              {myRequests.length} total request{myRequests.length !== 1 ? 's' : ''}
            </span>
          </h4>

          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400">Loading leave requests...</div>
          ) : myRequests.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No leave requests submitted yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {myRequests.map((req) => {
                const badge = statusBadge(req.status);
                const isPending = req.status === 'pending';
                const isEditing = editingId === req.id;

                return (
                  <div
                    key={req.id}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      isEditing
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : req.status === 'approved'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : req.status === 'rejected'
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    {/* Date Row */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">From Date</label>
                            <input type="date" value={editFrom} onChange={e => setEditFrom(e.target.value)}
                              className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">To Date</label>
                            <input type="date" value={editTo} min={editFrom} onChange={e => setEditTo(e.target.value)}
                              className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Reason</label>
                          <input type="text" value={editReason} onChange={e => setEditReason(e.target.value)}
                            className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleSaveEdit(req)} disabled={savingEdit}
                            className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-[11px] flex items-center justify-center gap-1">
                            <Save className="w-3 h-3" /> {savingEdit ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[11px]">
                            Cancel Edit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-amber-400" />
                              {req.from_date} → {req.to_date}
                            </div>
                            <div className="text-slate-400 mt-0.5">{req.reason}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${badge.cls}`}>
                              {badge.icon} {badge.label}
                            </span>
                          </div>
                        </div>

                        {/* Admin Response */}
                        {req.admin_response && (
                          <div className={`px-3 py-2 rounded-lg text-[11px] ${
                            req.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-red-500/10 text-red-300'
                          }`}>
                            <span className="font-bold">Admin Response: </span>
                            {req.admin_response}
                          </div>
                        )}

                        {/* Actions — only for pending requests */}
                        {isPending && (
                          <div className="flex gap-2 pt-1 border-t border-slate-800">
                            <button
                              onClick={() => startEdit(req)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[11px] font-medium transition-all"
                            >
                              <Edit2 className="w-3 h-3" /> Modify Dates / Reason
                            </button>
                            <button
                              onClick={() => handleCancel(req)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 text-red-400 rounded-lg text-[11px] font-medium transition-all"
                            >
                              <Trash2 className="w-3 h-3" /> Cancel Request
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
