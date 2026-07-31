import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Collapsible section wrapper for the Battery Analysis tab.
 * Consistent chevron header + smooth-ish open/close. Controlled or uncontrolled.
 */
const Accordion = ({
  title,
  subtitle = null,
  icon = null,
  defaultOpen = false,
  accent = 'amber',
  children,
  dense = false
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const accents = {
    amber: 'text-amber-300',
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-300',
    purple: 'text-purple-300',
    slate: 'text-slate-200'
  };
  const ring = {
    amber: 'border-amber-400/25 hover:border-amber-400/50',
    cyan: 'border-cyan-400/25 hover:border-cyan-400/50',
    emerald: 'border-emerald-400/25 hover:border-emerald-400/50',
    purple: 'border-purple-400/25 hover:border-purple-400/50',
    slate: 'border-slate-600/60 hover:border-slate-500'
  };

  return (
    <div className={`mb-3 rounded-xl border ${ring[accent] || ring.amber} bg-slate-900/30 overflow-hidden transition-colors`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="min-w-0">
            <span className={`block font-bold text-sm ${accents[accent] || accents.amber} truncate`}>{title}</span>
            {subtitle && <span className="block text-[11px] text-slate-400 truncate">{subtitle}</span>}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className={dense ? 'px-3 pb-3' : 'px-4 pb-4'}>
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
