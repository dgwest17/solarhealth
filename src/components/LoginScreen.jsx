import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';

/**
 * Login gate. Uses Supabase email/password auth.
 * Passwords are hashed + salted by Supabase — never stored or visible to us.
 *
 * For now you (admin) sign in here. Rep/client accounts use the SAME screen
 * later; the server decides what each role can see.
 */
const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [unverified, setUnverified] = useState(false);

  const handleLogin = async () => {
    setError('');
    setNotice('');
    if (!supabaseConfigured) {
      setError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      // Supabase returns this when the account exists but the email link was
      // never clicked. Surface a resend action instead of a dead-end error.
      if (/email not confirmed/i.test(error.message)) {
        setUnverified(true);
        setError('Please verify your email first. Check your inbox for the confirmation link.');
      } else {
        setUnverified(false);
        setError(error.message);
      }
    }
  };

  const resendConfirmation = async () => {
    setError(''); setNotice('');
    if (!email) { setError('Enter your email above first.'); return; }
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (err) setError(err.message);
    else setNotice(`Confirmation link re-sent to ${email} — check your inbox (and spam).`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  const forgotPassword = async () => {
    setError(''); setNotice('');
    if (!email) { setError('Enter your email above first, then click "Forgot password?"'); return; }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (err) setError(err.message);
    else setNotice(`Password reset link sent to ${email} — check your inbox.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1e36] to-[#0a1628] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 mb-4 shadow-lg shadow-amber-500/30">
            <ShieldCheck size={32} className="text-[#0a1628]" />
          </div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
            SolarHealth Monitoring
          </h1>
          <p className="text-slate-400 text-sm mt-2">Secure client portal</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-md border border-amber-400/20 rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-400/40 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm text-red-200">
                {error}
                {unverified && (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    className="block mt-2 text-amber-300 hover:text-amber-200 underline underline-offset-2 font-semibold"
                  >
                    Resend confirmation email
                  </button>
                )}
              </div>
            </div>
          )}
          {notice && (
            <div className="mb-4 bg-green-900/30 border border-green-400/40 rounded-lg p-3 text-sm text-green-200">
              {notice}
            </div>
          )}

          <label className="block text-xs text-amber-200/80 mb-1 uppercase tracking-wider">Email</label>
          <div className="relative mb-4">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="username"
              className="w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 focus:border-amber-400/60 focus:outline-none"
              placeholder="you@company.com"
            />
          </div>

          <label className="block text-xs text-amber-200/80 mb-1 uppercase tracking-wider">Password</label>
          <div className="relative mb-6">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
              className="w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 focus:border-amber-400/60 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <div className="text-right -mt-4 mb-5">
            <button type="button" onClick={forgotPassword} className="text-xs text-amber-400/80 hover:text-amber-300 underline underline-offset-2">
              Forgot password?
            </button>
          </div>

          <button
            onClick={handleLogin}
            disabled={busy}
            className={`w-full py-3 rounded-lg font-bold transition-all ${
              busy
                ? 'bg-slate-600 text-slate-300'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 text-[#0a1628] hover:shadow-lg hover:shadow-amber-500/30'
            }`}
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-xs text-slate-500 text-center mt-5">
            Protected by encrypted authentication. Your session is private.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
