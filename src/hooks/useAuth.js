import { useState, useEffect } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';

/**
 * Tracks the current auth session. Returns:
 *   { session, user, loading, configured }
 * and re-renders when the user logs in / out.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  return {
    session,
    user: session?.user || null,
    loading,
    configured: supabaseConfigured,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false)
  };
}
