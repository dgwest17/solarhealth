import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase, apiFetch } from './lib/supabaseClient';
import LoginScreen from './components/LoginScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import ClientDashboard from './components/ClientDashboard';
import AdminSettings from './admin/AdminSettings';
import TheBeach from './beach/TheBeach';
import SolarCalculator from './SolarCalculator';
import SharedProposalView from './proposal/SharedProposalView';
import {
  ArrowLeft, RefreshCw, AlertCircle, SlidersHorizontal, Home as HomeIcon, BarChart3,
  LayoutGrid, Users, FileText
} from 'lucide-react';
import { Beach as BeachIcon } from './surf/SurfIcons';
import AppShell from './surf/AppShell';
import Dashboard from './home/Dashboard';

/**
 * Top-level router for the Monitoring side.
 *
 *   not authenticated  -> LoginScreen
 *   staff, signed in   -> Home (the dashboard), inside the shell with the rail
 *   a customer         -> their own record, opened directly, as before
 *   client selected    -> SolarCalculator prefilled from that client's Zoho data
 *
 * Every signed-in page renders inside AppShell: the scene, the rail, the page.
 * The rail replaced the old top bar of buttons; it offers the same places plus
 * Home, and the open client's audit whenever there is one.
 */
/**
 * A shared proposal link (?proposal=<token>) renders BEFORE any auth gate.
 *
 * The customer has no login and never will — the link is the credential. Read
 * once at module scope so a re-render cannot lose it, and so the rest of App
 * never has to think about it.
 */
const SHARE_TOKEN = (() => {
  try {
    const t = new URLSearchParams(window.location.search).get('proposal');
    return t && /^[a-f0-9]{64}$/i.test(t) ? t : null;
  } catch { return null; }
})();

export default function App() {
  const { user, loading, configured, passwordRecovery, clearPasswordRecovery } = useAuth();

  const [selectedId, setSelectedId] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState('');
  const [role, setRole] = useState('client');
  /**
   * Whether `role` is known yet. It starts as 'client' and is only learned
   * from the first API response, so until then "role === 'client'" is a
   * default, not a fact — acting on it would bounce staff off Home.
   */
  const [roleResolved, setRoleResolved] = useState(false);
  const learnRole = useCallback((r) => {
    if (r) { setRole(r); setRoleResolved(true); }
  }, []);
  /**
   * 'home' | 'clients' | 'audit' | 'sandbox' | 'storage' | 'beach' | 'admin'
   *
   * 'storage' is the Sandbox opened on its Storage tab — the same screen, so
   * moving between the two keeps whatever the rep has typed.
   *
   * The open client's audit is a VIEW, not a mode that pre-empts the others.
   * It used to be the latter: `if (selectedId) return <audit>` sat above every
   * view check, so with a client open no other view could render. That is why
   * ProjectSteps was unreachable — its view existed, nothing navigated to it,
   * and navigating to it would not have worked anyway.
   *
   * Big Wave is a TAB inside the audit rather than a view here, because it is
   * about one client like every other tab in there, and a top-level tab that
   * only works when a client happens to be open reads as broken the first
   * time somebody clicks it from the dashboard.
   */
  const [view, setView] = useState('home');

  /**
   * Which tab the mounted calculator is showing, reported up by it. Drives two
   * things: which rail entry is lit (Energy Audit or Design), and the scene —
   * Storage sits in front of the wave, as in the reference.
   */
  const [calcTab, setCalcTab] = useState('audit');
  /** A tab request for the calculator: bump `n` to move it without remounting. */
  const [tabRequest, setTabRequest] = useState({ tab: 'audit', n: 0 });

  const navigate = useCallback((target) => {
    if (target === 'storage' || target === 'sandbox') {
      setTabRequest((r) => ({ tab: target === 'storage' ? 'battery' : 'audit', n: r.n + 1 }));
      setView('sandbox');
      return;
    }
    setView(target);
  }, []);

  const openClient = useCallback(async (id) => {
    setSelectedId(id);
    setView('audit');
    setLoadingClient(true);
    setClientError('');
    setClientData(null);
    try {
      const data = await apiFetch(`/api/client?id=${encodeURIComponent(id)}`);
      setClientData(data);
      learnRole(data.role || 'client');
    } catch (e) {
      setClientError(e.message);
    } finally {
      setLoadingClient(false);
    }
  }, [learnRole]);

  const backToDashboard = () => {
    setSelectedId(null);
    setClientData(null);
    setClientError('');
    setView('clients');
  };

  // A client owns exactly one record — open it directly instead of showing a
  // one-row list. Guarded so "Back" doesn't immediately re-open it (a client
  // can still land on their own dashboard row if they navigate back).
  const [autoOpened, setAutoOpened] = useState(false);
  const handleDashboardLoaded = useCallback((list, loadedRole) => {
    if (loadedRole === 'client' && !autoOpened && list && list.length === 1) {
      setAutoOpened(true);
      openClient(list[0].id);
    }
  }, [autoOpened, openClient]);

  // Home is for staff. A customer lands on their own record, as they always
  // have — but only once the role is actually known, not on the default.
  useEffect(() => {
    if (roleResolved && role === 'client' && view === 'home') setView('clients');
  }, [roleResolved, role, view]);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    backToDashboard();
  };

  // A shared proposal takes over the screen entirely, and comes before the
  // auth gates: the customer holding this link has no account. After the hooks,
  // for the same reason as password recovery below.
  if (SHARE_TOKEN) {
    return <SharedProposalView token={SHARE_TOKEN} />;
  }

  // Password-recovery link takes over the screen. Must come AFTER all hooks —
  // an early return above hooks changes hook order between renders (React #300).
  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={clearPasswordRecovery} />;
  }

  // ---- Auth gates ----
  if (loading) {
    return (
      <div className="min-h-screen bg-abyss flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="min-h-screen bg-abyss flex items-center justify-center p-6">
        <div className="max-w-md bg-slate-800/60 border border-amber-400/20 rounded-2xl p-8 text-center">
          <AlertCircle size={32} className="text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-amber-300 mb-2">Setup needed</h1>
          <p className="text-slate-300 text-sm">
            Add <code className="text-amber-200">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> to your environment,
            then redeploy to enable secure login.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // ---- Authenticated: everything below lives inside the shell ----
  const isStaff = role === 'admin' || role === 'rep';
  const clientLabel = clientData
    ? (clientData.contact?.fullName || clientData.contact?.email || '')
    : '';

  /**
   * The rail. Only places that exist; a customer gets none of them, because
   * their app is their own record.
   */
  const railItems = isStaff ? [
    { id: 'home',    label: 'Home',         icon: HomeIcon,          view: 'home' },
    { id: 'sandbox', label: 'Energy Audit', icon: BarChart3,         view: 'sandbox' },
    { id: 'storage', label: 'Design',       icon: LayoutGrid,        view: 'storage' },
    { id: 'clients', label: 'Clients',      icon: Users,             view: 'clients' },
    ...(clientData ? [{ id: 'audit', label: clientLabel || 'Open client', sub: 'Open audit', icon: FileText, view: 'audit' }] : []),
    { id: 'beach',   label: 'The Beach',    icon: BeachIcon,         view: 'beach' },
    ...(role === 'admin' ? [{ id: 'admin', label: 'Defaults', icon: SlidersHorizontal, view: 'admin' }] : [])
  ] : [];

  // Which entry is lit. The Sandbox is one screen with two entries, so the tab
  // it is actually showing decides between them.
  const railView = view === 'sandbox' ? (calcTab === 'battery' ? 'storage' : 'sandbox') : view;

  // Which scene. Storage sits in front of the wave, as the reference draws it,
  // in the sandbox or in a client's audit alike.
  const calcScene = calcTab === 'battery' ? 'wave' : 'palms';
  const scene = view === 'home' ? 'wave'
    : view === 'beach' ? 'beach'
    : (view === 'sandbox' || view === 'audit') ? calcScene
    : 'palms';
  const mood = view === 'home' || view === 'beach' ? 'vivid' : 'calm';

  const shell = (children) => (
    <AppShell
      items={railItems}
      view={railView}
      onNavigate={navigate}
      scene={scene}
      mood={mood}
      userEmail={user.email}
      role={roleResolved ? role : null}
      onSignOut={signOut}
    >
      {children}
    </AppShell>
  );

  // ---- client detail (audit) ----
  if (selectedId && view === 'audit') {
    if (loadingClient) {
      return shell(
        <div className="min-h-[70vh] flex items-center justify-center text-slate-300">
          <RefreshCw size={24} className="animate-spin text-amber-400 mr-3" /> Loading client audit…
        </div>
      );
    }
    if (clientError) {
      return shell(
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="max-w-md bg-red-900/20 border border-red-400/40 rounded-xl p-6 text-center">
            <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-200 text-sm mb-4">{clientError}</p>
            <button onClick={backToDashboard} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm">
              Back to dashboard
            </button>
          </div>
        </div>
      );
    }
    if (clientData) {
      const label = clientLabel;
      const isClientView = role === 'client';
      return shell(
        <div>
          <div className="px-6 pt-4 flex items-center justify-between print:hidden">
            {isClientView ? (
              <>
                <span className="text-amber-300 font-bold text-sm tracking-wide">Your Energy Best</span>
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-300 text-sm hover:text-amber-300"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={backToDashboard}
                className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200"
              >
                <ArrowLeft size={16} /> Back to all clients
              </button>
            )}
          </div>
          <SolarCalculator
            onTabChange={setCalcTab}
            prefilledInputs={clientData.auditInputs}
            clientLabel={label}
            clientContext={clientData.contact ? {
              contactId: clientData.contact.id,
              projectId: clientData.project ? clientData.project.id : null,
              // Reps can write to clients they own; the server re-checks
              // ownership on every write, so this only controls what's shown.
              // The dashboard already scopes a rep's list to their own clients,
              // so anything they can open here is theirs to edit.
              canWrite: (role === 'admin' || role === 'rep') && !!clientData.project,
              viewerRole: role,
              name: clientData.contact.fullName || clientData.contact.email || '',
              contact: clientData.contact,
              address: [clientData.contact.street, clientData.contact.city, clientData.contact.state, clientData.contact.zip].filter(Boolean).join(', '),
              // Big Wave is a tab inside the audit now, so "Open proposal"
              // is handled by SolarCalculator switching its own tab. Nothing
              // to route at this level.
              project: clientData.project || null,
              repEmail: user.email
            } : null}
          />
        </div>
      );
    }
  }

  // ---- Home ----
  if (view === 'home') {
    return shell(
      <Dashboard userEmail={user.email} role={role} onNavigate={navigate} onRole={learnRole} />
    );
  }

  // ---- The Beach (rep centre) ----
  if (view === 'beach') {
    return shell(<TheBeach role={role} userEmail={user.email} onOpenClient={openClient} />);
  }

  // ---- admin defaults ----
  if (view === 'admin') {
    return shell(<AdminSettings role={role} />);
  }

  // ---- sandbox (no client attached), and Storage within it ----
  if (view === 'sandbox') {
    return shell(
      <SolarCalculator
        onOpenClient={openClient}
        canSaveClient={role === 'admin' || role === 'rep'}
        tabRequest={tabRequest}
        onTabChange={setCalcTab}
      />
    );
  }

  // ---- client list ----
  return shell(
    <ClientDashboard
      onOpen={openClient}
      userEmail={user.email}
      role={role}
      onSignOut={signOut}
      onRole={learnRole}
      onLoaded={handleDashboardLoaded}
      hideHeader
    />
  );
}

