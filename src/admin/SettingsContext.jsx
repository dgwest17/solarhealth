/**
 * FILE: src/admin/SettingsContext.jsx
 *
 * Loads the org's editable defaults once and hands them to every component
 * that needs a market assumption.
 *
 * Failure behaviour is the point here. If the API is unreachable, the table
 * has not been created yet, or the user is offline, the provider falls back
 * to the code defaults and the app runs exactly as before. A settings store
 * that can take the tool down is worse than no settings store, so nothing
 * here throws and nothing blocks first paint.
 *
 * A localStorage copy is kept so a reload is instant and a rep in the field
 * with a flaky connection still gets the org's numbers rather than the
 * shipped ones.
 *
 * Used by: src/App.jsx (provider), and useSettings() anywhere below it.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { buildDefaultSettings, mergeSettings, diffSettings } from './settingsSchema';
import { supabase } from '../lib/supabaseClient';

const CACHE_KEY = 'solarhealth.settings.v1';

const SettingsContext = createContext(null);

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeCache = (patch) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(patch)); } catch { /* private mode */ }
};

async function authedFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(path, { ...options, headers });
  const text = await resp.text();
  const body = text ? JSON.parse(text) : {};
  if (!resp.ok) throw new Error(body.error || `Request failed (${resp.status})`);
  return body;
}

export function SettingsProvider({ children }) {
  // Start from cache so there is never a flash of shipped defaults.
  const [patch, setPatch] = useState(() => readCache());
  const [status, setStatus] = useState('loading'); // loading | ready | offline
  const [error, setError] = useState('');
  // Server-derived. The browser never decides whether it may edit defaults.
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await authedFetch('/api/settings');
        if (cancelled) return;
        const next = body.settings || {};
        setPatch(next);
        writeCache(next);
        setCanEdit(!!body.canEdit);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        // Cached or shipped defaults carry the app. This is not a user-facing
        // error unless they are on the admin page trying to save.
        setError(e.message);
        setStatus('offline');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const settings = useMemo(() => mergeSettings(patch), [patch]);

  const save = useCallback(async (full) => {
    const next = diffSettings(full);
    const body = await authedFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: next })
    });
    const saved = body.settings || next;
    setPatch(saved);
    writeCache(saved);
    setStatus('ready');
    setError('');
    return saved;
  }, []);

  const resetAll = useCallback(async () => {
    await authedFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ settings: {} }) });
    setPatch({});
    writeCache({});
    return buildDefaultSettings();
  }, []);

  const value = useMemo(() => ({
    settings, status, error, save, resetAll, canEdit,
    isCustomized: !!patch && Object.keys(patch).filter((k) => k !== 'version').length > 0
  }), [settings, status, error, save, resetAll, canEdit, patch]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/**
 * Settings for the current org.
 *
 * Safe outside a provider — returns the shipped defaults. That keeps every
 * consumer free of null checks and lets components be render-tested in
 * isolation.
 */
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx) return ctx;
  return {
    settings: buildDefaultSettings(),
    status: 'ready',
    error: '',
    save: async () => { throw new Error('Settings provider not mounted'); },
    resetAll: async () => buildDefaultSettings(),
    canEdit: false,
    isCustomized: false
  };
}

/** Just the assumptions block — the common case. */
export const useAssumptions = () => useSettings().settings.assumptions;

export default SettingsContext;
