import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
import { LogIn, UserPlus, X, Shield, Stethoscope, User, CheckCircle, Mail, KeyRound, ArrowRight, RefreshCw, QrCode, Lock, ExternalLink } from 'lucide-react';
import { UserRole } from '../../types';

interface AuthModalProps {
  initialPortal?: 'patient' | 'doctor' | 'admin';
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ initialPortal = 'patient', onClose }) => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  
  // 2-Step Email Verification State
  const [requiresVerification, setRequiresVerification] = useState<boolean>(false);
  const [verificationEmail, setVerificationEmail] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');

  // TOTP 2FA Challenge State
  const [requiresTotpChallenge, setRequiresTotpChallenge] = useState<boolean>(false);
  const [challengeId, setChallengeId] = useState<string>('');
  const [totpInput, setTotpInput] = useState<string>('');

  // TOTP 2FA Mandatory Setup State
  const [requiresTotpSetup, setRequiresTotpSetup] = useState<boolean>(false);
  const [setupUserId, setSetupUserId] = useState<string>('');
  const [setupSecret, setSetupSecret] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [setupCodeInput, setSetupCodeInput] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Default Email according to target portal
  const getDefaultEmailForPortal = () => {
    if (initialPortal === 'admin') return 'admin@health.org';
    if (initialPortal === 'doctor') return 'sarah.jenkins@health.org';
    return 'john.doe@example.com';
  };

  // Login Form State
  const [email, setEmail] = useState<string>(getDefaultEmailForPortal());
  const [password, setPassword] = useState<string>('password123');

  // Registration Form State
  const [name, setName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('password123');
  const [phone, setPhone] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [medicalHistory, setMedicalHistory] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Password Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email, password);

      if (res.requiresTwoFactorSetup) {
        setSetupUserId(res.userId);
        const setupData = await authApi.setupTotp(res.userId, res.email);
        setSetupSecret(setupData.secret);
        setQrCodeUrl(setupData.qrCodeUrl);
        setRequiresTotpSetup(true);
        return;
      }

      if (res.requiresTwoFactor) {
        setChallengeId(res.challengeId);
        setRequiresTotpChallenge(true);
        return;
      }

      if (res.token && res.user) {
        login(res.user, res.token);
        onClose();
      }
    } catch (err: any) {
      if (err.response?.data?.requiresVerification) {
        setVerificationEmail(err.response.data.email);
        setRequiresVerification(true);
      } else {
        setError(err.response?.data?.error || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. TOTP 2FA Login Challenge Verification
  const handleTotpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyTotpLogin(challengeId, totpInput);
      if (res.token && res.user) {
        login(res.user, res.token);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid 6-digit TOTP code');
    } finally {
      setLoading(false);
    }
  };

  // 3. TOTP 2FA Mandatory Setup Verification
  const handleTotpSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyTotpSetup(setupUserId, setupSecret, setupCodeInput);
      setRecoveryCodes(res.recoveryCodes || []);
      setSuccessMsg('TOTP MFA activated! Save your emergency recovery codes below.');
      // Auto-login with the token returned after setup
      if (res.token && res.user) {
        // Store token so user can proceed after saving recovery codes
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_pending_user', JSON.stringify(res.user));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to verify TOTP setup code');
    } finally {
      setLoading(false);
    }
  };

  // 4. Patient Registration Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.register({
        name,
        email: regEmail,
        password: regPassword,
        phone,
        dateOfBirth: dob,
        medicalHistory
      });

      setVerificationEmail(regEmail);
      setRequiresVerification(true);
      setSuccessMsg('Verification code and account activation link sent to your email address!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // 5. 2-Step Email Verification Submission
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyEmail(verificationEmail, verificationCode);
      if (res.token && res.user) {
        login(res.user, res.token);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await authApi.resendCode(verificationEmail);
      setSuccessMsg('New verification email and activation link sent to your email!');
    } catch (err) {
      setError('Failed to resend verification email');
    }
  };

  // Quick Demo Accounts Filtered by Context
  const quickAccounts = [
    { name: 'John Doe', email: 'john.doe@example.com', badge: 'Patient' },
    { name: 'Emily Watson', email: 'emily.watson@example.com', badge: 'Patient' },
    { name: 'Dr. Sarah Jenkins', email: 'sarah.jenkins@health.org', badge: 'Cardiology' },
    { name: 'Dr. Marcus Vance', email: 'marcus.vance@health.org', badge: 'Dermatology' },
    { name: 'Dr. Elena Rostova', email: 'elena.rostova@health.org', badge: 'Neurology' },
    { name: 'System Admin', email: 'admin@health.org', badge: 'Admin Portal' }
  ];

  const handleQuickLogin = (accEmail: string) => {
    setEmail(accEmail);
    setPassword('password123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6 relative border border-slate-700 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ------------------------------------------------------------- */}
        {/* SCREEN A: TOTP 2FA AUTHENTICATOR CHALLENGE SCREEN */}
        {/* ------------------------------------------------------------- */}
        {requiresTotpChallenge ? (
          <div className="space-y-5 animate-in fade-in">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">TOTP Authenticator Verification</h3>
              <p className="text-xs text-slate-400">
                Enter the 6-digit code from your Google Authenticator, Microsoft Authenticator, or Authy app.
              </p>
            </div>

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center">{error}</div>}

            <form onSubmit={handleTotpVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">6-Digit Authenticator Token</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={totpInput}
                  onChange={(e) => setTotpInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-700 placeholder:font-normal placeholder:tracking-normal"
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpInput.length < 6}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{loading ? 'Verifying MFA...' : 'Complete TOTP Login'}</span>
              </button>
            </form>

            <button onClick={() => setRequiresTotpChallenge(false)} className="text-xs text-slate-400 hover:text-white block mx-auto">
              ← Back to Sign In
            </button>
          </div>
        ) : requiresTotpSetup ? (
          /* ------------------------------------------------------------- */
          /* SCREEN B: MANDATORY TOTP MFA SETUP SCREEN */
          /* ------------------------------------------------------------- */
          <div className="space-y-4 animate-in fade-in">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Setup TOTP Authenticator (Mandatory)</h3>
              <p className="text-xs text-slate-400">
                Scan the QR Code with Google Authenticator or Microsoft Authenticator app.
              </p>
            </div>

            {qrCodeUrl && (
              <div className="p-3 bg-white rounded-xl w-44 h-44 mx-auto flex items-center justify-center shadow-lg">
                <img src={qrCodeUrl} alt="TOTP Authenticator QR Code" className="w-full h-full object-contain" />
              </div>
            )}

            {recoveryCodes.length > 0 ? (
              <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Emergency Recovery Codes (Save These):
                </h4>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-200">
                  {recoveryCodes.map((code, idx) => (
                    <div key={idx} className="bg-slate-950 p-1 rounded text-center border border-slate-800">{code}</div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const pendingUser = localStorage.getItem('auth_pending_user');
                    const pendingToken = localStorage.getItem('auth_token');
                    if (pendingUser && pendingToken) {
                      localStorage.removeItem('auth_pending_user');
                      login(JSON.parse(pendingUser), pendingToken);
                      onClose();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-400 mt-2"
                >
                  Continue to Dashboard →
                </button>
              </div>
            ) : (
              <form onSubmit={handleTotpSetupSubmit} className="space-y-3">
                {error && <div className="p-2 rounded-lg bg-red-500/10 text-red-300 text-xs text-center">{error}</div>}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">
                    Enter 6-Digit Code Generated by App *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={setupCodeInput}
                    onChange={(e) => setSetupCodeInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-xl font-bold tracking-widest text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-700 placeholder:font-normal placeholder:tracking-normal"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || setupCodeInput.length < 6}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{loading ? 'Activating MFA...' : 'Verify & Enable TOTP 2FA'}</span>
                </button>
              </form>
            )}
          </div>
        ) : requiresVerification ? (
          /* ------------------------------------------------------------- */
          /* SCREEN C: REAL PRODUCTION 2-STEP EMAIL VERIFICATION SCREEN */
          /* ------------------------------------------------------------- */
          <div className="space-y-5 animate-in fade-in">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">2-Step Email Verification</h3>
              <p className="text-xs text-slate-300">
                We sent a 6-digit verification code and account activation link to <strong className="text-cyan-400">{verificationEmail}</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs text-slate-300 space-y-1.5">
              <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Check Your Email Inbox:
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Click the <strong>Activate Account</strong> link inside your email, or check the <strong>Emails</strong> drawer in the top navigation bar to view your dispatched verification message.
              </p>
            </div>

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center">{error}</div>}

            <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">Enter 6-Digit Verification Code *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Enter 6-digit code..."
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-600 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{loading ? 'Verifying...' : 'Verify & Activate Account'}</span>
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <button onClick={() => setRequiresVerification(false)} className="hover:text-white">
                ← Back to Login
              </button>

              <button onClick={handleResendCode} className="text-cyan-400 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Resend Email
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* SCREEN D: MAIN LOGIN & PATIENT REGISTRATION FORMS */
          /* ------------------------------------------------------------- */
          <>
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {isRegister ? <UserPlus className="w-5 h-5 text-cyan-400" /> : <LogIn className="w-5 h-5 text-cyan-400" />}
                {isRegister ? 'New Patient Registration' : `${initialPortal.toUpperCase()} Portal Sign In`}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRegister ? 'Register your patient account to receive 2-step email verification.' : 'Sign in with Email, Password, and TOTP 2FA.'}
              </p>
            </div>

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>}

            {/* Registration allowed ONLY for Patient Portal (No Register as Admin / Doctor button) */}
            {initialPortal === 'patient' && (
              <div className="flex border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className={`flex-1 py-2 text-xs font-bold transition-all ${!isRegister ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegister(true)}
                  className={`flex-1 py-2 text-xs font-bold transition-all ${isRegister ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'}`}
                >
                  Register New Patient
                </button>
              </div>
            )}

            {!isRegister ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'Authenticating...' : `Sign In to ${initialPortal.toUpperCase()} Portal`}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Email Address * (Receives Verification Email)</label>
                  <input
                    type="email"
                    required
                    placeholder="jane.smith@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Password *</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+1-555-0192"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Sending Verification Email...' : 'Register & Send Verification Email'}</span>
                </button>
              </form>
            )}

            {/* Quick Demo Credentials Autofill Buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Autofill Credentials for {initialPortal.toUpperCase()} Portal:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {quickAccounts
                  .filter(acc => {
                    if (initialPortal === 'admin') return acc.badge === 'Admin Portal';
                    if (initialPortal === 'doctor') return acc.badge !== 'Patient' && acc.badge !== 'Admin Portal';
                    return acc.badge === 'Patient';
                  })
                  .map((acc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickLogin(acc.email)}
                      className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl transition-all"
                    >
                      <div className="text-xs font-bold text-white truncate">{acc.name}</div>
                      <div className="text-[10px] text-cyan-400">{acc.badge}</div>
                    </button>
                  ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
