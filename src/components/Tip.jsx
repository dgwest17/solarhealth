import React, { useState } from 'react';

/**
 * Tiny orange info icon with a click-to-open tooltip.
 * All tooltip text lives in src/config/tooltips.js — edit texts there.
 */
import { TOOLTIPS } from '../config/tooltips';

const Tip = ({ k }) => {
  const [open, setOpen] = useState(false);
  const text = TOOLTIPS[k];
  if (!text) return null;
  return (
    <span className="relative inline-block align-middle ml-1.5">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-4 h-4 rounded-full bg-orange-500/90 hover:bg-orange-400 text-[10px] font-bold text-white leading-none inline-flex items-center justify-center"
        aria-label="Help"
      >i</button>
      {open && (
        <span className="absolute z-[120] left-1/2 -translate-x-1/2 top-6 w-64 bg-slate-900 border border-orange-400/60 rounded-lg p-3 text-xs text-slate-200 shadow-2xl font-normal normal-case tracking-normal">
          {text}
        </span>
      )}
    </span>
  );
};

export default Tip;
