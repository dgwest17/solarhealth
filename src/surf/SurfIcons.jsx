/**
 * FILE: src/surf/SurfIcons.jsx
 *
 * SURF ICON SET — drawn, not borrowed.
 *
 * Every one of these is an original line drawing on a 24-unit grid, matching
 * lucide's stroke conventions (2px, round caps and joins, currentColor) so a
 * surf icon and a lucide icon can sit in the same row without a seam. They
 * exist because the named sections of this platform — Deep Seas, Treasure,
 * Swell, Quiver, Beach — have no equivalent in a generic icon set, and
 * reaching for a generic "wallet" or "chart" would flatten exactly the thing
 * that makes those names worth having.
 *
 * Rules held across the set:
 *   - Horizon lines sit on the same baseline, so icons in a row feel level.
 *   - Water is drawn as two or three stacked curves, never a filled blob.
 *   - Nothing is drawn at more than three strokes of detail; at 16px anything
 *     denser turns to mud.
 *
 * Usage mirrors lucide exactly:
 *   <Anchor size={16} className="text-cyan-400" />
 *
 * Used by: Deep Seas (pricing), and the Rep Center sections as they land.
 */
import React from 'react';

/**
 * Shared frame. `size` drives both dimensions; `strokeWidth` is exposed for
 * the rare large-format use where 2px reads heavy.
 */
const Icon = ({ size = 24, strokeWidth = 2, children, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {children}
  </svg>
);

/**
 * DEEP SEAS — the rep-only pricing panel.
 * A sounding weight on a line, descending past two depth marks. Reads as
 * "below the surface", which is exactly what the panel is.
 */
export const DeepSeas = (props) => (
  <Icon {...props}>
    <path d="M2 5c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
    <path d="M12 9v6" />
    <path d="M8.5 12h-3" />
    <path d="M18.5 12h-3" />
    <path d="M12 15a3 3 0 0 0-3 3c0 1.7 1.3 3 3 3s3-1.3 3-3a3 3 0 0 0-3-3Z" />
  </Icon>
);

/**
 * TREASURE — commissions in the pipeline.
 * A chest, half-buried, with a shine mark. Not a dollar sign: the money here
 * is earned and waiting, not counted.
 */
export const Treasure = (props) => (
  <Icon {...props}>
    <path d="M3 10.5A4.5 4.5 0 0 1 7.5 6h9A4.5 4.5 0 0 1 21 10.5V11H3v-.5Z" />
    <path d="M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
    <path d="M10 11v3h4v-3" />
    <path d="M12 14v2" />
    <path d="M6.5 8.5 8 7" />
  </Icon>
);

/**
 * SWELL — trajectory and conversion.
 * Three waves rising left to right, the last one peaking. The set building is
 * the metaphor: it is about direction over time, not a single number.
 */
export const Swell = (props) => (
  <Icon {...props}>
    <path d="M2 17c1.6 0 1.6-1.5 3.2-1.5S6.8 17 8.4 17" />
    <path d="M2 20.5c1.6 0 1.6-1.5 3.2-1.5s1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5" />
    <path d="M9 14.5c0-4.5 3-9 8-10.5 0 0 .5 4-1.5 7" />
    <path d="M15.5 11c2.5 0 4 1.5 4 1.5" />
  </Icon>
);

/**
 * QUIVER — the training and resource centre.
 * Three boards racked at an angle, different outlines. A quiver is a set of
 * boards for different conditions, which is the right shape for a library of
 * trainings.
 */
export const Quiver = (props) => (
  <Icon {...props}>
    <path d="M6.5 21c-1.4-2.8-1.4-11.2 0-14.5C7.2 4.9 8 3 8.4 3s1.2 1.9 1.9 3.5c1.4 3.3 1.4 11.7 0 14.5" />
    <path d="M14 21c-1.1-2.4-1.1-9.6 0-12.4.6-1.4 1.2-2.9 1.5-2.9s1.1 1.5 1.6 2.9c1.1 2.8 1.1 10 0 12.4" />
    <path d="M21 20.5c-.6-1.6-.6-6.4 0-8" />
  </Icon>
);

/**
 * BEACH — the installed book.
 * A shoreline: sun low over water meeting sand. Where the wave finally lands,
 * which is what an installed deal is.
 */
export const Beach = (props) => (
  <Icon {...props}>
    <circle cx="17" cy="7" r="3" />
    <path d="M2 13c2 0 2-1.2 4-1.2s2 1.2 4 1.2 2-1.2 4-1.2 2 1.2 4 1.2 2-1.2 4-1.2" />
    <path d="M2 17.5h20" />
    <path d="M5 21h14" />
  </Icon>
);

/**
 * TIDE — the timing/urgency tab.
 * A marker post with the waterline part-way up and a high-water notch above,
 * the same tide-post idea the customer app is built around.
 */
export const Tide = (props) => (
  <Icon {...props}>
    <path d="M8 2v20" />
    <path d="M8 6h4" />
    <path d="M8 10h6" />
    <path d="M8 14h4" />
    <path d="M2 18c2 0 2-1.3 4-1.3s2 1.3 4 1.3 2-1.3 4-1.3 2 1.3 4 1.3 2-1.3 4-1.3" />
    <path d="M14 9.5h7" strokeDasharray="2 2" />
  </Icon>
);

/**
 * BARREL — the audit itself, or any "inside the wave" moment.
 * A spiral opening toward light. Used where the reference artwork's barrel is
 * the right signal.
 */
export const Barrel = (props) => (
  <Icon {...props}>
    <path d="M21 4c0 8-4.5 15-10.5 15S2 15 3.5 11" />
    <path d="M21 4c-6.5 0-12 4.5-12 10.5 0 2.5 1.5 4.5 3.5 4.5" />
    <path d="M16.5 12.5a3.5 3.5 0 1 0-3.4 4.4" />
    <path d="M2 21c2 0 2-1.3 4-1.3s2 1.3 4 1.3" />
  </Icon>
);

/**
 * COMPASS ROSE — navigation / next steps.
 * Used on the customer proposal, where the whole point is "here is where you
 * go next".
 */
export const Heading = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5.5-5.5 2 2-5.5 5.5-2Z" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
  </Icon>
);

/**
 * BUOY — a checkpoint in a multi-step flow (Bank Qualification, Documents,
 * Intake). Floats, marks a position, you pass it on the way somewhere.
 */
export const Buoy = (props) => (
  <Icon {...props}>
    <path d="M12 3 9 13h6l-3-10Z" />
    <path d="M7.5 13h9l1 3h-11l1-3Z" />
    <path d="M2 19c2 0 2-1.3 4-1.3s2 1.3 4 1.3 2-1.3 4-1.3 2 1.3 4 1.3 2-1.3 4-1.3" />
  </Icon>
);

/**
 * SHELL — a saved artifact (a stored proposal). Something you pick up off the
 * beach and keep.
 */
export const Shell = (props) => (
  <Icon {...props}>
    <path d="M12 21c-5 0-9-3.8-9-8.5S7 3 12 3s9 4.8 9 9.5S17 21 12 21Z" />
    <path d="M12 21V3" />
    <path d="M12 21c-2.2-3-3.4-6.6-3.4-10.4" />
    <path d="M12 21c2.2-3 3.4-6.6 3.4-10.4" />
  </Icon>
);

export default {
  DeepSeas, Treasure, Swell, Quiver, Beach, Tide, Barrel, Heading, Buoy, Shell
};
