/**
 * FILE: src/surf/BatteryGraphic.jsx
 *
 * THE HOME BATTERY, DRAWN IN THREE DIMENSIONS.
 *
 * Pure SVG — no model file, no WebGL, no external asset. That constraint is
 * deliberate: this graphic has to survive being printed, emailed as a static
 * page, and rendered server-side into a proposal that still looks right two
 * years later. Anything that needs a runtime or a CDN fails at least one of
 * those.
 *
 * The depth comes from three things, which is all isometric drawing ever
 * needs: a consistent light source (upper left), a visible side face darker
 * than the front, and a cast shadow that grounds the unit instead of leaving
 * it floating. The charge column glows from within rather than being a flat
 * green bar, because a lit interior is what makes a box read as a device.
 *
 * Scales honestly: `count` draws real stacked units, so a customer buying
 * three packs sees three. Past four it switches to a stack-plus-count rather
 * than drawing a wall of boxes nobody can read.
 *
 * Used by: src/proposal/CustomerProposal.jsx
 */
import React from 'react';
import { BARREL, SURF } from './theme';

/**
 * @param {number} count      How many packs. 1–4 drawn individually.
 * @param {number} charge     0–1, how full the glow column reads.
 * @param {number} size       Width in px; height follows the aspect ratio.
 * @param {string} label      Optional text on the unit face (e.g. "13.5 kWh").
 */
const BatteryGraphic = ({ count = 1, charge = 0.82, size = 260, label = '', animate = true }) => {
  const units = Math.max(1, Math.min(4, Math.round(count) || 1));
  const overflow = Math.max(0, (Math.round(count) || 1) - units);

  // Isometric offsets. One skew angle for the whole drawing or it falls apart.
  const W = 120;           // front face width
  const H = 170;           // front face height
  const D = 34;            // depth, in x
  const DY = 20;           // depth, in y
  const GAP = 14;          // between stacked units

  const totalW = W + D + (units - 1) * (W * 0.16) + 40;
  const totalH = H + DY + (units - 1) * GAP + 70;
  const uid = React.useId ? React.useId().replace(/:/g, '') : 'bg';

  return (
    <svg
      width={size}
      height={size * (totalH / totalW)}
      viewBox={`0 0 ${totalW} ${totalH}`}
      role="img"
      aria-label={`${count} home batter${count === 1 ? 'y' : 'ies'}`}
    >
      <defs>
        {/* Front face: lit from upper left, falling into shadow bottom right */}
        <linearGradient id={`front${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#20536b" />
          <stop offset="55%"  stopColor="#143c50" />
          <stop offset="100%" stopColor="#0c2c3c" />
        </linearGradient>
        {/* Side face is always darker than the front — this is most of the 3D */}
        <linearGradient id={`side${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#0a2432" />
          <stop offset="100%" stopColor="#061a25" />
        </linearGradient>
        {/* Top catches the most light */}
        <linearGradient id={`top${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#2d6a83" />
          <stop offset="100%" stopColor="#1a4a61" />
        </linearGradient>
        {/* The charge column, lit from inside */}
        <linearGradient id={`charge${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor={BARREL.face} />
          <stop offset="55%"  stopColor={BARREL.shallows} />
          <stop offset="100%" stopColor={BARREL.foam} />
        </linearGradient>
        <linearGradient id={`sheen${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity=".16" />
          <stop offset="45%"  stopColor="#ffffff" stopOpacity=".03" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={`glow${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={`shadow${uid}`} cx="50%" cy="50%">
          <stop offset="0%"   stopColor="#000" stopOpacity=".5" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Cast shadow — grounds the unit. Without this it floats. */}
      <ellipse
        cx={20 + W / 2 + D / 2 + (units - 1) * (W * 0.08)}
        cy={totalH - 28}
        rx={W * 0.62 + (units - 1) * 8}
        ry="15"
        fill={`url(#shadow${uid})`}
      />

      {/* Back to front, so nearer units overlap further ones correctly. */}
      {Array.from({ length: units }, (_, i) => units - 1 - i).map((i) => {
        const x = 20 + i * (W * 0.16);
        const y = 34 + (units - 1 - i) * GAP;
        const isFront = i === 0;
        const chargeH = (H - 30) * Math.max(0, Math.min(1, charge));

        return (
          <g key={i} opacity={isFront ? 1 : 0.55 - (i - 1) * 0.08}>
            {/* top face */}
            <path
              d={`M${x},${y} L${x + D},${y - DY} L${x + D + W},${y - DY} L${x + W},${y} Z`}
              fill={`url(#top${uid})`}
            />
            {/* right side face */}
            <path
              d={`M${x + W},${y} L${x + D + W},${y - DY} L${x + D + W},${y - DY + H} L${x + W},${y + H} Z`}
              fill={`url(#side${uid})`}
            />
            {/* front face */}
            <rect x={x} y={y} width={W} height={H} rx="9" fill={`url(#front${uid})`} />
            <rect x={x} y={y} width={W} height={H} rx="9" fill={`url(#sheen${uid})`} />
            <rect
              x={x} y={y} width={W} height={H} rx="9"
              fill="none" stroke="rgba(143,200,215,.30)" strokeWidth="1.2"
            />

            {/* charge column, inset into the front face */}
            <rect
              x={x + 14} y={y + 15} width="16" height={H - 30}
              rx="8" fill="#08212e" stroke="rgba(143,200,215,.22)" strokeWidth="1"
            />
            <rect
              x={x + 14} y={y + 15 + (H - 30 - chargeH)} width="16" height={chargeH}
              rx="8" fill={`url(#charge${uid})`} filter={isFront ? `url(#glow${uid})` : undefined}
            >
              {animate && isFront && (
                <animate attributeName="opacity" values="0.82;1;0.82" dur="3.2s" repeatCount="indefinite" />
              )}
            </rect>

            {/* vent slots — small detail that stops it reading as a plain box */}
            {[0, 1, 2, 3].map((k) => (
              <rect
                key={k}
                x={x + 44} y={y + 26 + k * 9} width={W - 60} height="3" rx="1.5"
                fill="#081e2a" opacity=".65"
              />
            ))}

            {/* status lamp */}
            <circle cx={x + W - 20} cy={y + H - 22} r="4.5" fill={BARREL.foam} opacity=".9">
              {animate && isFront && (
                <animate attributeName="opacity" values="0.35;1;0.35" dur="2.4s" repeatCount="indefinite" />
              )}
            </circle>

            {isFront && label && (
              <text
                x={x + 44} y={y + H - 18}
                fill={SURF.textBright} fontSize="13" fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >{label}</text>
            )}
          </g>
        );
      })}

      {overflow > 0 && (
        <text
          x={totalW - 16} y={totalH - 46} textAnchor="end"
          fill={SURF.sun} fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif"
        >+{overflow} more</text>
      )}
    </svg>
  );
};

export default BatteryGraphic;
