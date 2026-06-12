import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativePrompt,
  parseNarrativeResponse
} from '../utils/narrativePrompt';

/**
 * "Your Personalized Report" card.
 * Calls /api/generate-narrative (Vercel serverless function) and renders
 * the structured narrative. Lifts the result up via onNarrativeGenerated
 * so the PDF report can include it.
 */
const AINarrative = ({ inputs, calculations, narrative, onNarrativeGenerated }) => {
  const [status, setStatus] = useState(narrative ? 'done' : 'idle'); // idle | loading | done | error
  const [errorMessage, setErrorMessage] = useState('');

  const generate = async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: NARRATIVE_SYSTEM_PROMPT,
          prompt: buildNarrativePrompt(inputs, calculations)
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      const parsed = parseNarrativeResponse(data.text);
      onNarrativeGenerated(parsed);
      setStatus('done');
    } catch (err) {
      console.error('Narrative generation error:', err);
      setErrorMessage(err.message || 'Something went wrong.');
      setStatus('error');
    }
  };

  const sections = narrative
    ? [
        { label: 'System Performance', body: narrative.performance },
        { label: 'Financial Health', body: narrative.financial },
        { label: 'Your Net Metering Situation', body: narrative.nem },
        { label: 'Energy Usage Outlook', body: narrative.usage }
      ]
    : [];

  return (
    <div className="bg-gradient-to-br from-[#0a1628] to-[#13243f] border border-amber-400/40 rounded-xl shadow-2xl p-8 mb-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-300 flex items-center gap-2">
            <Sparkles size={24} className="text-amber-400" />
            Your Personalized Report
          </h2>
          <p className="text-slate-300 text-sm mt-1">
            A plain-English summary of this audit, written for your specific system and numbers.
          </p>
        </div>

        {status !== 'loading' && (
          <button
            onClick={generate}
            className="print:hidden shrink-0 bg-amber-400 hover:bg-amber-300 text-[#0a1628] font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {status === 'done' ? <RefreshCw size={16} /> : <Sparkles size={16} />}
            {status === 'done' ? 'Regenerate' : 'Generate report'}
          </button>
        )}
      </div>

      {status === 'idle' && (
        <div className="print:hidden text-slate-400 text-sm border border-dashed border-slate-600 rounded-lg p-6 text-center">
          Run the audit above, then generate your personalized summary.
        </div>
      )}

      {status === 'loading' && (
        <div className="space-y-3 animate-pulse" aria-live="polite">
          <div className="h-5 bg-slate-700/60 rounded w-3/4" />
          <div className="h-4 bg-slate-700/40 rounded w-full" />
          <div className="h-4 bg-slate-700/40 rounded w-5/6" />
          <div className="h-4 bg-slate-700/40 rounded w-2/3" />
          <p className="text-amber-300/80 text-sm pt-2 flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            Analyzing your audit data…
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-900/30 border border-red-400/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-400 mt-0.5 shrink-0" size={20} />
          <div>
            <p className="text-red-200 text-sm mb-2">
              Couldn't generate the report: {errorMessage}
            </p>
            <button
              onClick={generate}
              className="text-sm text-red-300 underline hover:text-red-200"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {status === 'done' && narrative && (
        <div className="space-y-6">
          <p className="text-xl text-amber-100 font-medium leading-snug border-l-2 border-amber-400 pl-4">
            {narrative.headline}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sections.map((section) => (
              <div key={section.label} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-amber-300/90 text-xs font-semibold uppercase tracking-widest mb-2">
                  {section.label}
                </h3>
                <p className="text-slate-200 text-sm leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-amber-300/90 text-xs font-semibold uppercase tracking-widest mb-3">
              Recommended Actions
            </h3>
            <ol className="space-y-2">
              {narrative.actionItems.map((item) => (
                <li key={item.priority} className="flex items-start gap-3 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-amber-400 text-[#0a1628] text-sm font-bold flex items-center justify-center">
                    {item.priority}
                  </span>
                  <div>
                    <p className="text-slate-100 text-sm font-semibold">{item.title}</p>
                    <p className="text-slate-300 text-sm">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="text-amber-400 mt-0.5 shrink-0" size={20} />
            <p className="text-amber-100 text-sm leading-relaxed">{narrative.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AINarrative;
