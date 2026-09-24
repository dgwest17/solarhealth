/**
 * FILE: src/proposal/SharedProposalView.jsx
 *
 * THE CUSTOMER'S PROPOSAL, OPENED FROM A LINK.
 *
 * Rendered before every auth gate in App, because the person holding this link
 * has no account and is never going to make one. The link IS the credential.
 *
 * It renders the SAME CustomerProposal component a rep sees on the Big Wave
 * tab — not a second, simplified copy. A separate "public version" would be a
 * second thing to keep in step, and the first time they diverged the customer
 * would be reading a different proposal from the one the rep quoted.
 *
 * The server has already stripped everything rep-facing, so this component
 * could not leak a commission even if it tried to render one. That stripping is
 * deliberately not here: a link is a link, and whatever the endpoint returns is
 * what curl returns.
 *
 * A dead link says so plainly and gives no reason. Whether a token is wrong or
 * revoked is not the customer's problem and is useful only to somebody guessing.
 */
import React, { useEffect, useState } from 'react';
import { SURF } from '../surf/theme';
import { Beach } from '../surf/SurfIcons';
import CustomerProposal from './CustomerProposal';

const SharedProposalView = ({ token }) => {
  const [proposal, setProposal] = useState(null);
  const [state, setState] = useState('loading');  // loading | ready | gone

  useEffect(() => {
    let cancelled = false;
    // Plain fetch, not apiFetch: there is no session to attach and asking for
    // one would fail before the request left the page.
    fetch(`/api/shared-proposal?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gone'))))
      .then((body) => {
        if (cancelled) return;
        if (body && body.proposal) { setProposal(body.proposal); setState('ready'); }
        else setState('gone');
      })
      .catch(() => { if (!cancelled) setState('gone'); });
    return () => { cancelled = true; };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: SURF.abyss }}>
        <div className="text-[13px]" style={{ color: SURF.textMuted }}>Opening your proposal…</div>
      </div>
    );
  }

  if (state === 'gone') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: SURF.abyss }}>
        <div className="max-w-md text-center">
          <Beach size={40} style={{ color: SURF.sun }} className="mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2" style={{ color: SURF.textBright }}>
            This link is no longer active
          </h1>
          <p className="text-[13.5px]" style={{ color: SURF.textMuted }}>
            Ask whoever sent it to you for a fresh one — it takes them a second.
          </p>
        </div>
      </div>
    );
  }

  return <CustomerProposal proposal={proposal} />;
};

export default SharedProposalView;
