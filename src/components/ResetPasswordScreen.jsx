import React, { useState } from 'react';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

/**
 * Shown when the user arrives from a Supabase password-recovery email
 * (PASSWORD_RECOVERY auth event). Lets them set a new password, then
 * continues into the app.
 */
const ResetPasswordScreen = ({ onDone }) => {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError('');
    if (pw1.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (pw1 !== pw2) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => onDone && onDone(), 1200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1e36] to-[#0a1628] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-800/60 border border-amber-400/30 rounded-2xl shadow-2xl p-7">
        <h1 className="text-xl font-bold text-amber-300 mb-1">Set a new password</h1>
        <p className="text-sm text-slate-400 mb-5">You followed a password-reset link — choose a new password to finish.</p>

        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-400/40 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}
        {done && (
          <div className="mb-4 bg-green-900/30 border border-green-400/40 rounded-lg p-3 flex items-center gap-2 text-sm text-green-200">
            <CheckCircle size={16} className="text-green-400" /> Password updated — signing you in…
          </div>
        )}

        <label className="block text-xs text-amber-200/80 mb-1 uppercase tracking-wider">New password</label>
        <div className="relative mb-4">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password"
            className="w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 focus:border-amber-400/60 focus:outline-none" placeholder="At least 8 characters" />
        </div>
        <label className="block text-xs text-amber-200/80 mb-1 uppercase tracking-wider">Confirm password</label>
        <div className="relative mb-6">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password"
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 focus:border-amber-400/60 focus:outline-none" placeholder="Same again" />
        </div>

        <button onClick={submit} disabled={busy || done}
          className={`w-full py-2.5 rounded-lg font-semibold ${busy || done ? 'bg-slate-600 text-slate-400' : 'bg-amber-500 hover:bg-amber-400 text-[#0a1628]'}`}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </div>
    </div>
  );
};

export default ResetPasswordScreen;
