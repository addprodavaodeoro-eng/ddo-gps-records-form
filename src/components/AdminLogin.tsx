import { useState, FormEvent } from 'react';
import { User } from '../types.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup } from 'firebase/auth';
import { Lock, User as UserIcon, LogIn, Key, Sparkles, CheckCircle2, AlertCircle, Eye, EyeOff, Mail } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: User) => void;
  onBackClick: () => void;
}

export default function AdminLogin({ onLoginSuccess, onBackClick }: AdminLoginProps) {
  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Registration states
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<'Admin' | 'Staff'>('Admin');
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // Password change states
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Handle traditional Login
  const handleTraditionalLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || isLoading) return;

    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      if (data.user.mustChangePassword) {
        setMustChangePassword(true);
        setTempToken(data.token);
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Registration
  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!registerUsername.trim() || !registerEmail.trim() || !registerPassword.trim() || isLoading) return;

    setIsLoading(true);
    setLoginError(null);
    setRegisterSuccess(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: registerUsername.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
          role: registerRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request account');
      }

      setRegisterSuccess(data.message || 'Account registration requested successfully! Please wait for Super Admin approval.');
      setRegisterUsername('');
      setRegisterEmail('');
      setRegisterPassword('');
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google Firebase Login
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();

      // Send to backend to synchronize/upsert account and get admin JWT
      const res = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: idToken,
          email: result.user.email,
          name: result.user.displayName,
          uid: result.user.uid
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync authentication');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setLoginError(err.message || 'Google Authentication failed. Please verify in credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Mandatory Password Change on First Login
  const handlePasswordChangeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || isLoading) return;

    if (newPassword !== confirmNewPassword) {
      setLoginError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setLoginError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({
          currentPassword: password, // mcgiddo
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      // Successful password change - complete login
      const userRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password: newPassword })
      });

      const userData = await userRes.json();
      if (!userRes.ok) {
        throw new Error(userData.error || 'Re-login failed');
      }

      onLoginSuccess(userData.token, userData.user);
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || 'Failed to update administrative password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 font-sans" id="login-stage">
      
      {/* Branding and Greeting card */}
      <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in duration-300">
        
        {/* Card Header Banner */}
        <div className="bg-slate-950 p-6 text-center border-b border-slate-800">
          <div className="w-10 h-10 bg-emerald-500 mx-auto rounded-lg flex items-center justify-center text-white font-bold shadow-md mb-3">
            <span className="text-xl">D</span>
          </div>
          <h2 className="text-base font-bold tracking-tight leading-none text-white uppercase">DDRMS Portal</h2>
          <p className="text-[10px] text-emerald-400 font-bold mt-1.5 tracking-widest uppercase">Administrative Management Login</p>
        </div>

        {/* Form area */}
        <div className="p-6 md:p-8 space-y-6">
          
          {loginError && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg flex items-center gap-2 text-xs font-semibold leading-relaxed">
              <AlertCircle className="w-4.5 h-4.5 text-red-400 flex-shrink-0" />
              <p className="flex-1">{loginError}</p>
            </div>
          )}

          {registerSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-250 rounded-lg flex flex-col gap-2 text-xs font-semibold leading-relaxed animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-450 flex-shrink-0" />
                <p className="flex-1 font-bold uppercase tracking-wider">Registration Requested</p>
              </div>
              <p className="text-slate-300 font-medium">{registerSuccess}</p>
              <button 
                onClick={() => { setRegisterSuccess(null); setIsRegistering(false); }}
                className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg text-[10px] font-bold uppercase self-start transition cursor-pointer"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {!mustChangePassword ? (
            isRegistering ? (
              /* REGISTRATION FORM */
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <UserIcon className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      placeholder="Choose username"
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-semibold transition"
                      id="input-register-username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-semibold transition"
                      id="input-register-email"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-semibold transition"
                      id="input-register-password"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Requested System Role</label>
                  <select
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value as 'Admin' | 'Staff')}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-slate-300 focus:outline-none font-semibold transition cursor-pointer"
                    id="select-register-role"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                  id="btn-register-submit"
                >
                  {isLoading ? 'Submitting request...' : 'Create an Account'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(false); setLoginError(null); }}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    Already have an administrative account? Sign In
                  </button>
                </div>
              </form>
            ) : (
              /* STANDARD LOGIN FORM */
              <form onSubmit={handleTraditionalLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <UserIcon className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-semibold transition"
                      id="input-login-username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-semibold transition"
                      id="input-login-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                  id="btn-login-submit"
                >
                  {isLoading ? 'Verifying...' : 'Sign In Account'}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Or login with</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                {/* Google Sign In Gateway */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  id="btn-login-google"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Google Federated Sign-In
                </button>

                <div className="text-center pt-3 border-t border-slate-800/50 mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(true); setLoginError(null); setRegisterSuccess(null); }}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    Request to Create an Account
                  </button>
                </div>
              </form>
            )
          ) : (
            /* MANDATORY FIRST-TIME PASSWORD UPDATE FLOW */
            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg flex items-start gap-2 text-xs font-semibold leading-relaxed mb-2">
                <Sparkles className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
                <p className="flex-1 font-medium">First-time login detected. You are required to update your default admin password before entering the secure dashboard.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">New Secure Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-semibold transition"
                    id="input-new-password"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Confirm Secure Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-semibold transition"
                    id="input-confirm-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center"
                id="btn-password-submit"
              >
                {isLoading ? 'Updating credentials...' : 'Save & Enter Dashboard'}
              </button>
            </form>
          )}

          <button
            onClick={onBackClick}
            className="w-full text-center text-slate-400 hover:text-slate-200 text-xs font-semibold transition pt-2 block"
            id="btn-login-back"
          >
            &larr; Back to Public Geohazard Survey
          </button>
        </div>
      </div>
    </div>
  );
}
