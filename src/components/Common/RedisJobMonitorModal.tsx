import React, { useState, useEffect } from 'react';
import { RedisMetrics } from '../../types';
import { systemApi } from '../../services/api';
import { Server, X, RefreshCw, Activity, Mail, Pill, Sparkles } from 'lucide-react';

interface RedisJobMonitorModalProps {
  onClose: () => void;
}

export const RedisJobMonitorModal: React.FC<RedisJobMonitorModalProps> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<RedisMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await systemApi.getRedisMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load Redis queue metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 space-y-6 relative border border-slate-700 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Redis Background Job Queue Monitor</h3>
            <p className="text-xs text-slate-400">Monitoring Email Worker, Medication Reminders, and AI Summary Retries.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">Querying Redis queue metrics...</div>
        ) : metrics ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Queue Engine Mode:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> {metrics.mode}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Queue 1 */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <Mail className="w-5 h-5 text-cyan-400 mx-auto" />
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Email Worker</div>
                <div className="text-2xl font-bold text-white">{metrics.queues.emailWorkerQueue}</div>
              </div>

              {/* Queue 2 */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <Pill className="w-5 h-5 text-emerald-400 mx-auto" />
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Reminders Worker</div>
                <div className="text-2xl font-bold text-white">{metrics.queues.medicationRemindersQueue}</div>
              </div>

              {/* Queue 3 */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <Sparkles className="w-5 h-5 text-amber-400 mx-auto" />
                <div className="text-[10px] text-slate-400 uppercase font-semibold">AI Retry Worker</div>
                <div className="text-2xl font-bold text-white">{metrics.queues.aiSummaryRetryQueue}</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center italic">
              Background job workers process queues every 10 seconds.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Metrics
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
