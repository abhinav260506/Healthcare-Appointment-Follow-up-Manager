import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Server, Key, LogIn, LogOut, Shield, Stethoscope, UserCheck, User } from 'lucide-react';
import { UserRole } from '../types';

interface NavbarProps {
  activePortal: 'patient' | 'doctor' | 'admin';
  onSelectPortal: (portal: 'patient' | 'doctor' | 'admin') => void;
  onOpenEmailLogs: () => void;
  onOpenRedisMetrics: () => void;
  onOpenApiKeyModal: () => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePortal,
  onSelectPortal,
  onOpenEmailLogs,
  onOpenRedisMetrics,
  onOpenApiKeyModal,
  onOpenAuthModal
}) => {
  const { user, role, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                HealthCare Hub
              </span>
              <div className="flex items-center space-x-2 text-xs text-cyan-400 font-medium">
                <span>Appointment & Follow-up Platform</span>
              </div>
            </div>
          </div>

          {/* Portal Navigation Tabs (Role RBAC Enforced) */}
          <div className="hidden md:flex items-center p-1 bg-slate-800/80 border border-slate-700/60 rounded-xl">
            <button
              onClick={() => onSelectPortal('patient')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activePortal === 'patient'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Patient Portal</span>
            </button>

            <button
              onClick={() => onSelectPortal('doctor')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activePortal === 'doctor'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Doctor Portal</span>
            </button>

            <button
              onClick={() => onSelectPortal('admin')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activePortal === 'admin'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* Quick Action Tools & Active User */}
          <div className="flex items-center space-x-3">
            
            {/* Account / Login Button */}
            {user ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onOpenAuthModal}
                  className="flex items-center space-x-2 px-3 py-1.5 text-xs font-bold text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl shadow-md transition-all"
                >
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{user.name.split(' ')[0]} ({user.role.toUpperCase()})</span>
                </button>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center space-x-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl shadow-md transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Register</span>
              </button>
            )}

            {/* Email Inbox Logs Drawer Button */}
            <button
              onClick={onOpenEmailLogs}
              title="View Dispatched Email Logs & HTML Previews"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
            >
              <Mail className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Emails</span>
            </button>

            {/* Redis Queue Status Monitor Button */}
            <button
              onClick={onOpenRedisMetrics}
              title="Inspect Redis Background Job Queues"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
            >
              <Server className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Queues</span>
            </button>

            {/* API Key Settings Button */}
            <button
              onClick={onOpenApiKeyModal}
              title="Configure Google Gemini API Key"
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
            >
              <Key className="w-4 h-4 text-amber-400" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
