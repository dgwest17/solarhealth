/**
 * FILE: src/surf/Skin.jsx
 *
 * THE SKIN — the pieces every screen is dressed in.
 *
 * One file, because the alternative is each screen inventing its own idea of a
 * glass card and the app slowly becoming five apps. Nothing here knows anything
 * about solar, commission or clients; it takes content and makes it look like
 * the place it belongs to.
 *
 * ---------------------------------------------------------------------------
 * ABOUT THE PICTURES
 *
 * The scenes behind every page are illustrations, drawn in src/surf/Scenes.jsx.
 * A photograph can replace any of them by setting its URL in src/surf/art.js;
 * the illustration is not a placeholder for one, and either is a finished state.
 *
 * ---------------------------------------------------------------------------
 * THE SCRIMS ARE NOT DECORATION
 *
 * White text over a picture is unreadable about a third of the time — a bright
 * sky and the headline disappears. Every card here that sits on art lays a dark
 * gradient over it where the words go. That is the one part of this file that
 * must not be tuned away for looking heavy on a favourite picture.
 *
 * Used by: src/surf/AppShell.jsx, src/home/Dashboard.jsx
 */
import React from 'react';
import { SURF, GRADIENTS } from './theme';

/* ========================================================================== *
 * SURFACES
 * ========================================================================== */

/**
 * A panel that reads as glass over the hero rather than a flat card.
 *
 * `tone` picks the border: 'plain', 'warm' for something being emphasised, or
 * 'good' / 'danger' for a state. The fill stays the same in every case — colour
 * carries meaning on the border and the figure, never the whole surface, or
 * everything ends up shouting.
 */
export const Glass = ({ tone = 'plain', className = '', style = null, children, ...rest }) => {
  const border = {
    plain:  'rgba(127,240,230,.16)',
    warm:   'rgba(232,163,61,.42)',
    good:   'rgba(79,191,155,.42)',
    danger: 'rgba(209,88,74,.45)'
  }[tone] || SURF.line;

  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'linear-gradient(160deg, rgba(16,58,72,.66) 0%, rgba(7,32,42,.80) 100%)',
        border: `1px solid ${border}`,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 18px 50px -24px rgba(0,0,0,.85)',
        ...(style || {})
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

/**
 * One headline figure with its label and, when there is one, its movement.
 *
 * `delta` is rendered only when a real one is passed. A stat tile with an
 * invented "+18%" under it is the single fastest way to make a dashboard
 * untrustworthy, so there is no default.
 */
export const StatTile = ({ icon: Icon, label, value, unit = null, delta = null, tone = SURF.sun }) => (
  <Glass className="px-4 py-4 min-w-0">
    <div className="flex items-center gap-3.5">
      {Icon && (
        <Icon strokeWidth={1.7} className="shrink-0 w-7 h-7 sm:w-[34px] sm:h-[34px]"
              style={{ color: tone, filter: `drop-shadow(0 0 10px ${tone}66)` }} />
      )}
      <div className="min-w-0">
        <div className="text-[13px] leading-tight" style={{ color: SURF.text }}>{label}</div>
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="font-display font-bold leading-tight"
                style={{ fontSize: 'clamp(24px, 2.3vw, 32px)', color: '#fff' }}>
            {value}
          </span>
          {unit && <span className="text-[14px]" style={{ color: SURF.text }}>{unit}</span>}
        </div>
        {delta && (
          <div className="text-[12px] font-semibold" style={{ color: delta.up ? '#3ddc97' : SURF.danger }}>
            {delta.up ? '▲' : '▼'} {delta.label}
          </div>
        )}
      </div>
    </div>
  </Glass>
);

/**
 * A big tappable route out of a page.
 *
 * `onClick` is required and there is no disabled variant on purpose: a card
 * this prominent that does nothing when pressed is worse than one that is not
 * there. Things that do not exist yet belong in the sidebar's quiet list.
 */
export const ActionCard = ({ icon: Icon, title, sub = null, onClick, art = null, minHeight = 190 }) => (
  <button
    onClick={onClick}
    className="group relative overflow-hidden rounded-2xl text-left w-full transition-all duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400"
    style={{
      minHeight,
      border: '1px solid rgba(127,240,230,.16)',
      background: GRADIENTS.barrelSoft,
      boxShadow: '0 22px 50px -26px rgba(0,0,0,.9)'
    }}
  >
    {/* the picture, then a scrim that darkens only where the words sit */}
    {/* The picture fills the top two-thirds and the words sit on a dark band
        below it, as in the reference — laid over the picture, a two-line
        title lands right on the house or the batteries. */}
    {art && (
      <span className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: '68%' }}>
        <span className="block w-full h-full transition-transform duration-500 group-hover:scale-[1.05]">{art}</span>
      </span>
    )}
    <span className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(4,20,26,0) 42%, rgba(6,27,34,.9) 64%, rgba(6,27,34,.97) 100%)' }} />
    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(127,240,230,.45), 0 0 40px -10px rgba(63,224,212,.45)', borderRadius: 16 }} />
    <div className="relative h-full flex items-end gap-3 p-4" style={{ minHeight }}>
      <span
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          width: 46, height: 46,
          background: 'rgba(6,27,34,.55)',
          border: '1px solid rgba(127,240,230,.35)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
        }}
      >
        {Icon && <Icon size={21} style={{ color: SURF.sun }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-tight font-display" style={{ color: '#fff' }}>
          {title}
        </span>
        {sub && (
          <span className="block text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,.72)' }}>
            {sub}
          </span>
        )}
      </span>
      <span
        className="shrink-0 text-[20px] transition-transform duration-200 group-hover:translate-x-1"
        style={{ color: '#fff' }}
        aria-hidden
      >
        →
      </span>
    </div>
  </button>
);

/* ========================================================================== *
 * NAVIGATION
 * ========================================================================== */

/**
 * The left rail.
 *
 * ONLY PLACES THAT EXIST. The reference design lists Transactions, Leads,
 * Calendar and Reports; none of those is built, so none of them is here. A rail
 * that offers a page and then shows nothing teaches reps that the rail lies, and
 * a greyed-out "coming soon" list is a promise nobody has made. When a page is
 * built it gets an entry.
 *
 * `items` are { id, label, icon, view, sub? }. `sub` is a second line, used for
 * the open client so the rep can always see whose audit they are in.
 */
export const SideNav = ({ items = [], view, onNavigate, footer = null }) => (
  <nav
    className="hidden lg:flex flex-col shrink-0 print:hidden sticky top-0 h-screen"
    style={{
      width: 216,
      background: 'linear-gradient(180deg, rgba(10,40,52,.78) 0%, rgba(5,24,31,.88) 100%)',
      borderRight: '1px solid rgba(127,240,230,.10)',
      backdropFilter: 'blur(20px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.2)'
    }}
    aria-label="Main"
  >
    <div className="px-5 pt-6 pb-5 flex items-center">
      <WaveMark size={58} />
    </div>

    <div className="px-3 space-y-1 flex-1 overflow-y-auto">
      {items.map(({ id, label, sub = null, icon: Icon, view: target }) => {
        const on = view === target;
        return (
          <button
            key={id}
            onClick={() => onNavigate(target)}
            aria-current={on ? 'page' : undefined}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors"
            style={on
              ? {
                  background: 'linear-gradient(90deg, rgba(63,224,212,.26) 0%, rgba(63,224,212,.10) 100%)',
                  border: '1px solid rgba(127,240,230,.38)',
                  boxShadow: '0 0 24px -8px rgba(63,224,212,.55)'
                }
              : { background: 'transparent', border: '1px solid transparent' }}
          >
            {Icon && <Icon size={19} style={{ color: on ? '#7ff0e6' : SURF.textMuted, flexShrink: 0 }} />}
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold truncate"
                    style={{ color: on ? '#fff' : SURF.text }}>
                {label}
              </span>
              {sub && (
                <span className="block text-[11px] truncate" style={{ color: SURF.textMuted }}>{sub}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>

    <div className="p-4">{footer}</div>
  </nav>
);

/**
 * The same destinations across the top, for screens too narrow for the rail.
 * Scrolls sideways rather than wrapping, so it never changes height.
 */
export const TopNav = ({ items = [], view, onNavigate, right = null }) => (
  <div
    className="lg:hidden print:hidden sticky top-0 z-30 flex items-center gap-2 px-3 py-2"
    style={{
      background: 'rgba(6,27,34,.86)',
      borderBottom: '1px solid rgba(127,240,230,.12)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)'
    }}
  >
    <WaveMark size={32} />
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {items.map(({ id, label, icon: Icon, view: target }) => {
          const on = view === target;
          return (
            <button
              key={id}
              onClick={() => onNavigate(target)}
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap flex items-center gap-1.5"
              style={on
                ? { background: 'rgba(63,224,212,.22)', color: '#fff', border: '1px solid rgba(127,240,230,.38)' }
                : { background: 'transparent', color: SURF.textMuted, border: '1px solid transparent' }}
            >
              {Icon && <Icon size={14} />} {label}
            </button>
          );
        })}
      </div>
    </div>
    {right}
  </div>
);

/* ========================================================================== *
 * THE MARK
 * ========================================================================== */

/**
 * The logo: a sun setting behind a wave, drawn rather than fetched so it is
 * crisp at any size and costs no request.
 */
export const WaveMark = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Your Energy Best">
    <defs>
      <linearGradient id="wm-sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f7c95c" />
        <stop offset="55%" stopColor="#e8a33d" />
        <stop offset="100%" stopColor="#c98a3c" />
      </linearGradient>
      <linearGradient id="wm-sea" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#0b2a3d" />
        <stop offset="45%" stopColor="#1d8a9b" />
        <stop offset="100%" stopColor="#43b3a5" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#wm-sky)" />
    <circle cx="32" cy="27" r="9" fill="#fde9a9" opacity=".95" />
    {/* the wave, curling right to left across the lower half */}
    <path
      d="M2 40c8-7 15-2 21 2s13 7 20 2c5-3 9-8 19-9v30H2z"
      fill="url(#wm-sea)"
    />
    <path
      d="M2 44c9-6 16-1 22 3s12 5 19 1c6-3 11-7 19-8"
      fill="none" stroke="#8fd6c0" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round"
    />
    <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
  </svg>
);

/**
 * Who is signed in.
 *
 * The initial is drawn, not a photo: the app stores no profile pictures, and a
 * stock silhouette where a face should be looks worse than a letter.
 * `compact` stacks it for the foot of the rail.
 */
export const UserChip = ({ email, role = null, onSignOut = null, compact = false }) => {
  const name = String(email || '').split('@')[0];
  const avatar = (
    <span
      className="rounded-full flex items-center justify-center text-[14px] font-bold shrink-0"
      style={{
        width: 38, height: 38, color: '#06202c',
        background: GRADIENTS.sunrise, border: '2px solid rgba(255,255,255,.35)',
        boxShadow: '0 0 18px -4px rgba(247,201,92,.6)'
      }}
    >
      {String(email || '?').slice(0, 1).toUpperCase()}
    </span>
  );
  if (compact) {
    return (
      <div className="rounded-xl p-2.5"
           style={{ background: 'rgba(0,0,0,.22)', border: '1px solid rgba(127,240,230,.12)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          {avatar}
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold truncate" style={{ color: '#fff' }}>{name}</div>
            {role && <div className="text-[10.5px] capitalize" style={{ color: SURF.textMuted }}>{role}</div>}
          </div>
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="mt-2 w-full px-2 py-1.5 rounded-lg text-[11.5px] font-semibold"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: SURF.text }}
          >
            Sign out
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-right hidden sm:block">
        <div className="text-[13px] font-semibold" style={{ color: '#fff' }}>{name}</div>
        {role && <div className="text-[10.5px] capitalize" style={{ color: 'rgba(255,255,255,.62)' }}>{role}</div>}
      </div>
      {avatar}
    </div>
  );
};

export default { Glass, StatTile, ActionCard, SideNav, TopNav, WaveMark, UserChip };
