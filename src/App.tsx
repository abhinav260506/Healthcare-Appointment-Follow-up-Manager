import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { DoctorSearch } from './components/PatientPortal/DoctorSearch';
import { BookingModal } from './components/PatientPortal/BookingModal';
import { PatientDashboard } from './components/PatientPortal/PatientDashboard';
import { DoctorDashboard } from './components/DoctorPortal/DoctorDashboard';
import { DoctorManagement } from './components/AdminPortal/DoctorManagement';
import { LeaveManagement } from './components/AdminPortal/LeaveManagement';
import { EmailInboxDrawer } from './components/Common/EmailInboxDrawer';
import { RedisJobMonitorModal } from './components/Common/RedisJobMonitorModal';
import { ApiKeyModal } from './components/Common/ApiKeyModal';
import { AuthModal } from './components/Common/AuthModal';
import { Doctor, UserRole } from './types';
import { authApi } from './services/api';
import { ShieldAlert, User, UserX, Stethoscope, CheckCircle2, Lock, LogIn } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user } = useAuth();

  // Selected Active Portal View
  const [activePortal, setActivePortal] = useState<'patient' | 'doctor' | 'admin'>(() => {
    return user?.role || 'patient';
  });

  // Modals & Drawers State
  const [showEmailLogs, setShowEmailLogs] = useState<boolean>(false);
  const [showRedisMetrics, setShowRedisMetrics] = useState<boolean>(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authTargetPortal, setAuthTargetPortal] = useState<'patient' | 'doctor' | 'admin'>('patient');

  // Patient Booking Wizard State
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);

  // Admin Sub-Tab State
  const [adminTab, setAdminTab] = useState<'doctors' | 'leaves'>('doctors');

  // URL Email Verification Link Handler
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role) {
      setActivePortal(user.role);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyEmail = params.get('verify_email');
    const code = params.get('code');

    if (verifyEmail && code) {
      authApi.verifyEmail(verifyEmail, code).then((res) => {
        if (res.token && res.user) {
          localStorage.setItem('auth_token', res.token);
          localStorage.setItem('auth_user', JSON.stringify(res.user));
          setActivationNotice(`Account for ${verifyEmail} activated successfully via email link!`);
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      }).catch((err) => {
        alert(err.response?.data?.error || 'Email link verification failed');
      });
    }
  }, []);

  const handleSelectPortal = (portal: 'patient' | 'doctor' | 'admin') => {
    setActivePortal(portal);
    if (!user) {
      setAuthTargetPortal(portal);
      setShowAuthModal(true);
    }
  };

  const handleOpenBookingModal = (doc?: Doctor | null) => {
    if (!user) {
      setAuthTargetPortal('patient');
      setShowAuthModal(true);
      return;
    }
    setSelectedDoctorForBooking(doc || null);
    setShowBookingModal(true);
  };

  // Check RBAC Authorization for current active portal view
  const isAuthorizedForPortal = () => {
    if (!user) return false;
    return user.role === activePortal;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <Navbar
        activePortal={activePortal}
        onSelectPortal={handleSelectPortal}
        onOpenEmailLogs={() => setShowEmailLogs(true)}
        onOpenRedisMetrics={() => setShowRedisMetrics(true)}
        onOpenApiKeyModal={() => setShowApiKeyModal(true)}
        onOpenAuthModal={() => {
          setAuthTargetPortal(activePortal);
          setShowAuthModal(true);
        }}
      />

      {/* Account Activation Banner */}
      {activationNotice && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold py-2.5 px-4 text-center flex items-center justify-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4" />
          <span>{activationNotice}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ------------------------------------------------------------- */}
        {/* CASE 1: UNAUTHENTICATED USER LANDING / PROMPT */}
        {/* ------------------------------------------------------------- */}
        {!user && (
          <div className="glass-panel rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-6 my-12 border border-slate-800 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-white">Authentication Required</h2>
              <p className="text-slate-400 text-sm">
                Please sign in with your email, password, and TOTP 2FA code to access the <strong className="text-cyan-400 capitalize">{activePortal} Portal</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setAuthTargetPortal(activePortal);
                  setShowAuthModal(true);
                }}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to {activePortal.toUpperCase()} Portal</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 2: AUTHENTICATED USER ROLE MISMATCH (403 FORBIDDEN) */}
        {/* ------------------------------------------------------------- */}
        {user && !isAuthorizedForPortal() && (
          <div className="glass-panel rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-6 my-12 border border-red-500/30 bg-red-950/20 shadow-2xl animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto shadow-lg">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-white">403 Forbidden: Access Denied</h2>
              <p className="text-red-300 text-sm">
                You are currently signed in as a <strong className="text-white uppercase">{user.role}</strong>. You are not authorized to view the <strong className="text-white uppercase">{activePortal} Portal</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
              Backend Role Authorization Enforcement: HTTP 403 Forbidden. Doctors and Admins cannot access Patient resources, and Patients cannot access Doctor/Admin Dashboards.
            </div>

            <button
              onClick={() => setActivePortal(user.role as any)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 text-xs transition-all"
            >
              Switch Back to My {user.role.toUpperCase()} Dashboard →
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 3: PATIENT PORTAL VIEW (Authorized Patient Only) */}
        {/* ------------------------------------------------------------- */}
        {user && isAuthorizedForPortal() && activePortal === 'patient' && (
          <div className="space-y-8">
            <DoctorSearch onSelectDoctor={(doc) => handleOpenBookingModal(doc)} />
            <PatientDashboard onNewBookingClick={(doc) => handleOpenBookingModal(doc)} />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 4: DOCTOR PORTAL VIEW (Authorized Doctor Only) */}
        {/* ------------------------------------------------------------- */}
        {user && isAuthorizedForPortal() && activePortal === 'doctor' && (
          <DoctorDashboard />
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 5: ADMIN PORTAL VIEW (Authorized Admin Only) */}
        {/* ------------------------------------------------------------- */}
        {user && isAuthorizedForPortal() && activePortal === 'admin' && (
          <div className="space-y-6">
            {/* Admin Sub-Tabs */}
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
              <button
                onClick={() => setAdminTab('doctors')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  adminTab === 'doctors'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>Doctor Profiles & Working Hours</span>
              </button>

              <button
                onClick={() => setAdminTab('leaves')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  adminTab === 'leaves'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <UserX className="w-4 h-4" />
                <span>Doctor Leave Requests & Admin Approval</span>
              </button>
            </div>

            {adminTab === 'doctors' ? <DoctorManagement /> : <LeaveManagement />}
          </div>
        )}

      </main>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          doctor={selectedDoctorForBooking}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedDoctorForBooking(null);
          }}
          onBookingComplete={() => {
            setShowBookingModal(false);
            setSelectedDoctorForBooking(null);
          }}
        />
      )}

      {/* Utility Drawers & Modals */}
      {showAuthModal && (
        <AuthModal
          initialPortal={authTargetPortal}
          onClose={() => setShowAuthModal(false)}
        />
      )}
      {showEmailLogs && <EmailInboxDrawer onClose={() => setShowEmailLogs(false)} />}
      {showRedisMetrics && <RedisJobMonitorModal onClose={() => setShowRedisMetrics(false)} />}
      {showApiKeyModal && <ApiKeyModal onClose={() => setShowApiKeyModal(false)} />}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Healthcare Appointment & Follow-up Manager © 2026</span>
          <span className="text-slate-400">PostgreSQL Data Layer • Redis Queues • Google Gemini AI • Google Calendar OAuth</span>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

export default App;
