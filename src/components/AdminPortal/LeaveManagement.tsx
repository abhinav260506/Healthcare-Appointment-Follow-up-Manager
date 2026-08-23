import React, { useState, useEffect } from 'react';
import { Doctor, LeaveRequest } from '../../types';
import { doctorApi } from '../../services/api';
import { Calendar, UserX, AlertTriangle, CheckCircle, XCircle, Mail, Clock, ShieldCheck, ChevronRight } from 'lucide-react';

export const LeaveManagement: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Direct Leave Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('Medical Symposium & Professional Leave');
  const [submittingDirect, setSubmittingDirect] = useState<boolean>(false);

  // Admin Response Feedback State
  const [actionFeedback, setActionFeedback] = useState<{
    requestId: string;
    status: string;
    affectedCount: number;
    affectedPatients: Array<{ patientName: string; patientEmail: string; date: string; time: string }>;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsData, reqsData] = await Promise.all([
        doctorApi.getAll(),
        doctorApi.getLeaveRequests()
      ]);
      setDoctors(docsData);
      setLeaveRequests(reqsData);
      if (docsData.length > 0) setSelectedDoctorId(docsData[0].id);
    } catch (err) {
      console.error('Error loading leave management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRespond = async (requestId: string, status: 'approved' | 'rejected') => {
    setProcessingId(requestId);
    setActionFeedback(null);
    try {
      const res = await doctorApi.respondLeaveRequest(requestId, status, 'Reviewed & processed by Admin');
      setActionFeedback({
        requestId,
        status,
        affectedCount: res.affectedCount || 0,
        affectedPatients: res.affectedPatients || []
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to respond to leave request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDirectLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !fromDate || !toDate) return;

    setSubmittingDirect(true);
    setActionFeedback(null);

    try {
      // 1. Submit leave request
      const req = await doctorApi.submitLeaveRequest(selectedDoctorId, fromDate, toDate, reason);
      // 2. Immediately approve as Admin
      const res = await doctorApi.respondLeaveRequest(req.id, 'approved', 'Directly granted by Admin');
      setActionFeedback({
        requestId: req.id,
        status: 'approved',
        affectedCount: res.affectedCount || 0,
        affectedPatients: res.affectedPatients || []
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to grant leave');
    } finally {
      setSubmittingDirect(false);
    }
  };

  const pendingRequests = leaveRequests.filter((r) => r.status === 'pending');
  const pastRequests = leaveRequests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-amber-400" />
          Doctor Leave Management & Admin Approval Desk
        </h2>
        <p className="text-slate-400 text-sm">
          Review, approve, or reject doctor leave requests (from date to date). When approved, affected patient bookings are automatically cancelled and notified.
        </p>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
              <CheckCircle className="w-5 h-5 text-amber-400" />
              <span>Leave Request {actionFeedback.status.toUpperCase()}</span>
            </div>
            <span className="text-xs text-amber-400 font-semibold">
              Affected Bookings Cancelled & Notified: {actionFeedback.affectedCount}
            </span>
          </div>

          {actionFeedback.affectedCount > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-amber-500/20 text-xs">
              <span className="text-slate-400 font-semibold uppercase">Notified Impacted Patients:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {actionFeedback.affectedPatients.map((pat, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-between">
                    <div>
                      <strong className="text-white">{pat.patientName}</strong> ({pat.patientEmail})
                    </div>
                    <span className="text-amber-400">{pat.date} @ {pat.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid Layout: Pending Requests Review (Left) + Direct Grant Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Pending Doctor Leave Requests requiring Admin Review */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Pending Doctor Leave Requests ({pendingRequests.length})
            </h3>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">Loading leave requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400/40 mx-auto" />
              <p>No pending doctor leave requests waiting for review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">{req.doctor_name}</h4>
                      <p className="text-xs text-cyan-400">{req.specialisation}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Pending Review
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                    <div className="text-slate-300">
                      <strong>Requested Leave Duration:</strong> <span className="text-amber-300 font-bold">{req.from_date}</span> to <span className="text-amber-300 font-bold">{req.to_date}</span>
                    </div>
                    <div className="text-slate-400">
                      <strong>Reason:</strong> {req.reason}
                    </div>
                  </div>

                  {/* Admin Approve / Reject Actions */}
                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                    <button
                      disabled={processingId === req.id}
                      onClick={() => handleAdminRespond(req.id, 'rejected')}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" /> Reject Request
                    </button>

                    <button
                      disabled={processingId === req.id}
                      onClick={() => handleAdminRespond(req.id, 'approved')}
                      className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve & Notify Patients
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Direct Admin Grant Form */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calendar className="w-5 h-5 text-amber-400" />
            Direct Admin Leave Grant
          </h3>

          <form onSubmit={handleDirectLeaveSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialisation})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">From Date</label>
                <input
                  type="date"
                  required
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">To Date</label>
                <input
                  type="date"
                  required
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Leave</label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Attending Conference / Personal Leave"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingDirect}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 text-sm flex items-center justify-center gap-2 transition-all"
            >
              {submittingDirect ? (
                <span>Granting Leave & Processing...</span>
              ) : (
                <>
                  <UserX className="w-4 h-4" />
                  <span>Grant Multi-Day Leave</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>

      {/* Historical Leave Request Log */}
      {pastRequests.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
            Historical Doctor Leave Request Log ({pastRequests.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pastRequests.map((req) => (
              <div key={req.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{req.doctor_name} ({req.specialisation})</div>
                  <div className="text-slate-400">{req.from_date} → {req.to_date}</div>
                  <div className="text-slate-500 italic mt-0.5">{req.reason}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'} capitalize`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
