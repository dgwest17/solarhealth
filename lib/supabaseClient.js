import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client.
 *
 * These two values are PUBLIC by design — the anon key is meant to ship to
 * the browser and is safe to expose. It can only do what your Supabase
 * Row-Level-Security policies allow. (Your Zoho secrets are a different story
 * and live only server-side in /api.)
 *
 * Set in Vercel + .env.local:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

/**
 * Helper: get the current access token to send to our /api endpoints.
 */
export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Authenticated fetch to our own /api — attaches the Supabase JWT so the
 * server can verify identity + role.
 */
export async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(path, { ...options, headers });
  if (!resp.ok) {
    let msg = `Request failed (${resp.status})`;
    try {
      const j = await resp.json();
      msg = j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return resp.json();
}
