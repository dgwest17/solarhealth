/**
 * FILE: src/surf/theme.js
 *
 * SURF DESIGN TOKENS — the aesthetic the whole platform is moving toward.
 *
 * Drawn from the reference artwork: a surfer inside the barrel, the wave
 * rendered as stained glass. Three things in that image are doing the work,
 * and they are what these tokens encode:
 *
 *   1. THE GRADIENT RUNS COLD TO WARM, LEFT TO RIGHT. Deep water on one side,
 *      sun through the lip on the other. Every gradient here runs that way —
 *      it is the difference between "a blue and orange thing" and a barrel.
 *
 *   2. THE LIGHT IS AT THE END OF THE TUNNEL. The brightest point is small,
 *      warm, and far away, with everything nearer in shadow. So the accent
 *      colour is used sparingly, on the one number that matters, and never
 *      spread evenly across a page.
 *
 *   3. THE SURFACE IS FACETED, NOT FLAT. Mosaic cells catch light at slightly
 *      different angles. Surfaces get a faint faceted texture rather than a
 *      flat fill or a glassmorphism blur.
 *
 * What this deliberately is NOT: the navy-and-green every solar competitor
 * uses, and not the uniform-card-grid look that reads as AI-generated. The
 * antidote both times is hierarchy — one enormous number, one signature
 * moment, restraint everywhere else.
 *
 * Used by: src/surf/SurfIcons.jsx, src/proposal/CustomerProposal.jsx, and
 * progressively by the rest of the app as sections are reworked.
 */

/**
 * The barrel gradient, cold to warm. Stops are named for where they sit in
 * the wave rather than for their hue, so a later palette change does not turn
 * every variable name into a lie.
 */
export const BARREL = {
  deepWater:  '#0b2a3d',
  openOcean:  '#12556b',
  face:       '#1d8a9b',
  shallows:   '#43b3a5',
  foam:       '#8fd6c0',
  lipShadow:  '#c98a3c',
  lip:        '#e8a33d',
  sunlight:   '#f7c95c',
  coreLight:  '#fde9a9'
};

/** Sand and shell — the neutrals. Warm, never grey-blue. */
export const SAND = {
  wet:    '#3d3833',
  dark:   '#2a2622',
  mid:    '#6b6154',
  light:  '#c9bda9',
  pale:   '#ece3d4',
  foam:   '#f9f5ed'
};

/**
 * Semantic roles. Components reference these, not the raw ramps above, so a
 * palette change is one file and not a find-and-replace across the app.
 */
export const SURF = {
  // surfaces, darkest to lightest
  abyss:       BARREL.deepWater,
  deep:        '#0f3346',
  surface:     '#14425a',
  shallow:     '#1b5a70',

  // text on dark surfaces
  textBright:  '#f4f9f7',
  text:        '#cfe3e2',
  textMuted:   '#8fb0b8',
  textFaint:   '#5b7c88',

  // the accent — used once per view, on the number that matters
  sun:         BARREL.sunlight,
  sunDeep:     BARREL.lip,
  sunGlow:     BARREL.coreLight,

  // supporting
  sea:         BARREL.face,
  seaBright:   BARREL.shallows,
  foam:        BARREL.foam,

  // states
  good:        '#4fbf9b',
  caution:     BARREL.lip,
  danger:      '#d1584a',

  // lines
  line:        'rgba(143,176,184,.22)',
  lineStrong:  'rgba(143,176,184,.40)'
};

/** CSS gradient strings. Always cold on the left, warm on the right. */
export const GRADIENTS = {
  barrel:      `linear-gradient(100deg, ${BARREL.deepWater} 0%, ${BARREL.openOcean} 22%, ${BARREL.face} 45%, ${BARREL.shallows} 62%, ${BARREL.lip} 84%, ${BARREL.sunlight} 100%)`,
  barrelSoft:  `linear-gradient(100deg, ${BARREL.deepWater} 0%, ${BARREL.face} 55%, ${BARREL.lipShadow} 100%)`,
  sunrise:     `linear-gradient(180deg, ${BARREL.sunlight} 0%, ${BARREL.lip} 100%)`,
  depth:       `linear-gradient(180deg, ${SURF.surface} 0%, ${SURF.abyss} 100%)`,
  // For text that should read as light coming through the lip.
  lipText:     `linear-gradient(95deg, ${BARREL.sunlight} 0%, ${BARREL.coreLight} 45%, ${BARREL.lip} 100%)`
};

/**
 * The faceted texture, as an inline SVG data URI so a page can carry it with
 * no network request — artifacts and printed proposals both need that.
 * Deliberately faint: it should register as a surface quality, not a pattern.
 */
export const FACET_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='64' viewBox='0 0 56 64'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='.05' stroke-width='1'%3E%3Cpath d='M28 0L56 16v32L28 64 0 48V16z'/%3E%3Cpath d='M28 0v64M0 16l56 32M56 16L0 48'/%3E%3C/g%3E%3C/svg%3E\")";

/** Type. One display face for moments, one workhorse, one for figures. */
export const TYPE = {
  display: "'Outfit', 'Avenir Next', system-ui, sans-serif",
  body:    "'Inter', system-ui, -apple-system, sans-serif",
  mono:    "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace"
};

/**
 * Tailwind-flavoured class fragments for the sections already built in
 * Tailwind, so the aesthetic can land incrementally without a rewrite.
 */
export const TW = {
  panel:        'rounded-2xl border border-[rgba(143,176,184,.22)] bg-[#0f3346]/70',
  panelWarm:    'rounded-2xl border border-[rgba(232,163,61,.35)] bg-[#14425a]/60',
  headline:     'text-transparent bg-clip-text bg-gradient-to-r from-[#f7c95c] via-[#fde9a9] to-[#e8a33d]',
  subtle:       'text-[#8fb0b8]',
  body:         'text-[#cfe3e2]',
  bright:       'text-[#f4f9f7]'
};

export default SURF;
