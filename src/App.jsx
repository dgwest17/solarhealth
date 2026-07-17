import React, { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase, apiFetch } from './lib/supabaseClient';
import LoginScreen from './components/LoginScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import ClientDashboard from './components/ClientDashboard';
import SolarCalculator from './SolarCalculator';
import { ArrowLeft, RefreshCw, AlertCircle, FlaskConical } from 'lucide-react';

/**
 * Top-level router for the Monitoring side.
 *
 *   not authenticated  -> LoginScreen
 *   authenticated      -> ClientDashboard (role-scoped list)
 *   client selected    -> SolarCalculator prefilled from that client's Zoho data
 *
 * The plain audit tool (standalone calculator) is still available to admins
 * via the dashboard, but the default authenticated view is the client list.
 */
export default function App() {
  const { user, loading, configured, passwordRecovery, clearPasswordRecovery } = useAuth();

  const [selectedId, setSelectedId] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState('');
  const [role, setRole] = useState('client');
  const [view, setView] = useState('clients'); // 'clients' | 'sandbox'

  const openClient = useCallback(async (id) => {
    setSelectedId(id);
    setLoadingClient(true);
    setClientError('');
    setClientData(null);
    try {
      const data = await apiFetch(`/api/client?id=${encodeURIComponent(id)}`);
      setClientData(data);
      setRole(data.role || 'client');
    } catch (e) {
      setClientError(e.message);
    } finally {
      setLoadingClient(false);
    }
  }, []);

  const backToDashboard = () => {
    setSelectedId(null);
    setClientData(null);
    setClientError('');
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    backToDashboard();
  };

  // Password-recovery link takes over the screen. Must come AFTER all hooks —
  // an early return above hooks changes hook order between renders (React #300).
  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={clearPasswordRecovery} />;
  }

  // ---- Auth gates ----
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-6">
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

  // ---- Authenticated: client detail (audit) ----
  if (selectedId) {
    if (loadingClient) {
      return (
        <div className="min-h-screen bg-[#0a1628] flex items-center justify-center text-slate-300">
          <RefreshCw size={24} className="animate-spin text-amber-400 mr-3" /> Loading client audit…
        </div>
      );
    }
    if (clientError) {
      return (
        <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-6">
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
      const label = clientData.contact?.fullName || clientData.contact?.email || '';
      return (
        <div>
          <div className="bg-[#0a1628] px-6 pt-4">
            <button
              onClick={backToDashboard}
              className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200 print:hidden"
            >
              <ArrowLeft size={16} /> Back to all clients
            </button>
          </div>
          <SolarCalculator
            prefilledInputs={clientData.auditInputs}
            clientLabel={label}
            clientContext={clientData.contact ? {
              contactId: clientData.contact.id,
              projectId: clientData.project ? clientData.project.id : null,
              canWrite: role === 'admin' && !!clientData.project,
              name: clientData.contact.fullName || clientData.contact.email || '',
              contact: clientData.contact,
              address: [clientData.contact.street, clientData.contact.city, clientData.contact.state, clientData.contact.zip].filter(Boolean).join(', ')
            } : null}
          />
        </div>
      );
    }
  }

  // ---- Authenticated: sandbox (no client attached) ----
  if (view === 'sandbox') {
    return (
      <div>
        <NavBar view={view} setView={setView} userEmail={user.email} onSignOut={signOut} />
        <SolarCalculator onOpenClient={openClient} canSaveClient={role === 'admin' || role === 'rep'} />
      </div>
    );
  }

  // ---- Authenticated: dashboard ----
  return (
    <div>
      <NavBar view={view} setView={setView} userEmail={user.email} onSignOut={signOut} />
      <ClientDashboard
        onOpen={openClient}
        userEmail={user.email}
        role={role}
        onSignOut={signOut}
        onRole={setRole}
        hideHeader
      />
    </div>
  );
}

/**
 * Top navigation bar: switch between the Clients dashboard and the
 * standalone Sandbox (audit + battery tools with no client data).
 */
function NavBar({ view, setView, userEmail, onSignOut }) {
  return (
    <div className="bg-[#0a1628] border-b border-amber-400/20 px-6 py-3 flex items-center justify-between print:hidden">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('clients')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            view === 'clients'
              ? 'bg-amber-400 text-[#0a1628]'
              : 'bg-slate-800/60 text-slate-300 hover:text-amber-300 border border-slate-600'
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => setView('sandbox')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
            view === 'sandbox'
              ? 'bg-amber-400 text-[#0a1628]'
              : 'bg-slate-800/60 text-slate-300 hover:text-amber-300 border border-slate-600'
          }`}
        >
          <FlaskConical size={15} /> Sandbox
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 hidden sm:block">{userEmail}</span>
        <button onClick={onSignOut} className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-300 text-sm hover:text-amber-300">
          Sign out
        </button>
      </div>
    </div>
  );
}
