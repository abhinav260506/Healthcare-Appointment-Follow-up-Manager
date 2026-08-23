import React, { useState } from 'react';
import { systemApi } from '../../services/api';
import { Key, X, CheckCircle, Sparkles } from 'lucide-react';

interface ApiKeyModalProps {
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [saved, setSaved] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await systemApi.updateGeminiKey(apiKey);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      alert('Failed to update API Key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6 relative border border-slate-700 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Google Gemini LLM API Key</h3>
            <p className="text-xs text-slate-400">Configure your key or rely on built-in heuristic LLM engine.</p>
          </div>
        </div>

        {saved ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center space-y-1">
            <CheckCircle className="w-6 h-6 mx-auto" />
            <p className="font-bold">Gemini API Key Saved!</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Enter Gemini API Key</label>
              <input
                type="password"
                required
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              If left unconfigured, the system automatically uses the built-in LLM fallback engine so pre-visit & post-visit summaries always work smoothly.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !apiKey}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-xl text-xs shadow-md"
              >
                {saving ? 'Saving Key...' : 'Save API Key'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
