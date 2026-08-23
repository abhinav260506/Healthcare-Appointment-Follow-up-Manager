import React, { useState, useEffect } from 'react';
import { EmailLog } from '../../types';
import { systemApi } from '../../services/api';
import { Mail, X, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface EmailInboxDrawerProps {
  onClose: () => void;
}

export const EmailInboxDrawer: React.FC<EmailInboxDrawerProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await systemApi.getEmailLogs();
      setLogs(data);
      if (data.length > 0) setSelectedLog(data[0]);
    } catch (err) {
      console.error('Failed to load email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Dispatched Email Inbox & HTML Log</h3>
              <p className="text-xs text-slate-400">Real-time log of booking confirmations, reminders, and leave notices.</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchLogs}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Refresh Inbox"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          
          {/* Left Email List */}
          <div className="col-span-5 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading email logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No emails logged yet.</div>
            ) : (
              logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`w-full p-3.5 text-left transition-all ${
                    selectedLog?.id === log.id ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="truncate max-w-[120px] font-semibold text-slate-300">{log.recipient}</span>
                    <span className="text-[10px]">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate">{log.subject}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-cyan-400 uppercase">
                    {log.type}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Right HTML Preview */}
          <div className="col-span-7 overflow-y-auto p-4 bg-slate-950">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <div><span className="text-slate-400">To:</span> <strong className="text-white">{selectedLog.recipient}</strong></div>
                  <div><span className="text-slate-400">Subject:</span> <strong className="text-cyan-400">{selectedLog.subject}</strong></div>
                  <div><span className="text-slate-400">Status:</span> <span className="text-emerald-400 font-bold uppercase">{selectedLog.status}</span></div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-white p-4 overflow-x-auto text-slate-900 text-sm">
                  <div dangerouslySetInnerHTML={{ __html: selectedLog.html_content }} />
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">Select an email log on the left to preview rendered HTML content.</div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
