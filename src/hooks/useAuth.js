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

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  return {
    session,
    user: session?.user || null,
    loading,
    configured: supabaseConfigured
  };
}
