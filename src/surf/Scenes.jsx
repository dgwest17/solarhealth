/**
 * FILE: src/surf/Scenes.jsx
 *
 * THE SCENES — the pictures every page sits in front of.
 *
 * The reference designs put the product inside a place: a barrel wave at golden
 * hour, a cliff of palms at dusk, a beach hut with its lights on. That sense of
 * place is most of what they are selling, so it is drawn here rather than
 * approximated with a gradient.
 *
 * ---------------------------------------------------------------------------
 * WHY SVG AND NOT PHOTOGRAPHS
 *
 * Drawn, they cost no download, are sharp on any screen, never fail to load
 * halfway through an appointment, and can be made darker exactly where text
 * sits. They also carry no licence question. A photograph can still replace any
 * of them: set its URL in src/surf/art.js and the scene steps aside for it,
 * with the same scrim over the top so text stays readable.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THESE ARE DRAWN TO
 *
 * Mostly dark, one warm light. Panels sit on top of these, and a translucent
 * panel over a large flat field of orange turns a muddy olive. So each scene is
 * deep teal and navy almost everywhere, with the sun and its glow confined to
 * one region — which is also what makes the glow read as light rather than as
 * a colour.
 *
 * Every gradient id is prefixed per instance (useId), because two scenes on
 * one page would otherwise share ids and the second would silently paint with
 * the first one's colours.
 *
 * Used by: src/surf/AppShell.jsx, src/home/Dashboard.jsx, src/beach/TheBeach.jsx
 */
import React, { useId } from 'react';

const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/* ========================================================================== *
 * PRIMITIVES
 * ========================================================================== */

/**
 * A palm, as a silhouette.
 *
 * The trunk is a tapered curve and each frond a drooping crescent — the two
 * things that make a palm read as a palm at silhouette size. Deterministic
 * rather than random, so a re-render never reshuffles the skyline.
 */
export const Palm = ({ x, y, h = 260, lean = 30, scale = 1, fill = '#04161c', fronds = 9, spread = 1 }) => {
  const s = scale;
  const topX = x + lean * s;
  const topY = y - h * s;
  const base = 7 * s, tip = 3 * s;
  // Trunk: two quadratic sides meeting at the crown.
  const cX = x + lean * 0.35 * s, cY = y - h * 0.55 * s;
  const trunk = [
    `M ${x - base} ${y}`,
    `Q ${cX - base * 0.8} ${cY} ${topX - tip} ${topY}`,
    `L ${topX + tip} ${topY}`,
    `Q ${cX + base * 0.8} ${cY} ${x + base} ${y}`,
    'Z'
  ].join(' ');

  const leaves = [];
  for (let i = 0; i < fronds; i++) {
    // Fan from upper-left round to upper-right and down both sides.
    const a = (-170 + (i * 340) / (fronds - 1)) * (Math.PI / 180);
    const len = (70 + ((i * 37) % 30)) * s * spread;
    const droop = (28 + ((i * 13) % 18)) * s;
    const tx = topX + Math.cos(a) * len;
    const ty = topY + Math.sin(a) * len * 0.55 + droop;
    const mx = (topX + tx) / 2, my = (topY + ty) / 2;
    const nx = -(ty - topY), ny = tx - topX;
    const nl = Math.hypot(nx, ny) || 1;
    const w = 14 * s;
    const c1x = mx + (nx / nl) * w, c1y = my + (ny / nl) * w - 10 * s;
    const c2x = mx - (nx / nl) * w * 0.25, c2y = my - (ny / nl) * w * 0.25;
    leaves.push(`M ${topX} ${topY} Q ${c1x} ${c1y} ${tx} ${ty} Q ${c2x} ${c2y} ${topX} ${topY} Z`);
  }

  return (
    <g fill={fill}>
      <path d={trunk} />
      {leaves.map((d, i) => <path key={i} d={d} />)}
      <circle cx={topX} cy={topY} r={6 * s} />
    </g>
  );
};

/** Warm window dots scattered across a silhouette — lived-in, not empty. */
const Windows = ({ points = [], color = '#ffcf7a', r = 3 }) => (
  <g fill={color}>
    {points.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={r} opacity={0.7 + ((i * 7) % 3) / 10} />)}
  </g>
);

/** Glints on water. Twinkle slowly; still for anyone who asked for less motion. */
const Glints = ({ points = [], color = '#fff3c4' }) => (
  <g fill={color}>
    {points.map(([cx, cy, w], i) => (
      <ellipse
        key={i} cx={cx} cy={cy} rx={w || 6} ry={1.4}
        style={{ animation: `skin-twinkle ${3 + (i % 4)}s ease-in-out ${(i % 5) * 0.6}s infinite` }}
      />
    ))}
  </g>
);

/* ========================================================================== *
 * SCENE: THE BARREL — Home, and the Storage view
 * ========================================================================== */

/**
 * Golden hour inside a barrel wave, the sun sitting in the tube.
 *
 * The board riding the face has solar cells for a deck — the one literal nod to
 * what the company does, drawn without a rider, because a crude figure would
 * cheapen the whole picture and the board alone carries the idea.
 */
export const SceneWave = ({ className = '', style = null }) => {
  const u = useUid();
  const id = (n) => `${u}${n}`;
  return (
    <svg className={className} style={style} viewBox="0 0 1600 900"
         preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#061b22" />
          <stop offset="34%" stopColor="#0c3a48" />
          <stop offset="56%" stopColor="#2a4d5c" />
          <stop offset="70%" stopColor="#8a5260" />
          <stop offset="84%" stopColor="#e2803c" />
          <stop offset="100%" stopColor="#f7b04a" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.70" cy="0.42" r="0.62">
          <stop offset="0%" stopColor="#fff5d0" stopOpacity="1" />
          <stop offset="12%" stopColor="#ffd36b" stopOpacity="1" />
          <stop offset="34%" stopColor="#f5932f" stopOpacity=".8" />
          <stop offset="62%" stopColor="#d9652a" stopOpacity=".35" />
          <stop offset="100%" stopColor="#d9652a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('sea')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f4a57" />
          <stop offset="55%" stopColor="#082f3a" />
          <stop offset="100%" stopColor="#04161c" />
        </linearGradient>
        <linearGradient id={id('face')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a3a44" />
          <stop offset="45%" stopColor="#0f7f83" />
          <stop offset="75%" stopColor="#23b9b0" />
          <stop offset="100%" stopColor="#7fe3cf" />
        </linearGradient>
        <radialGradient id={id('tube')} cx="0.55" cy="0.42" r="0.62">
          <stop offset="0%" stopColor="#fff6d6" />
          <stop offset="16%" stopColor="#ffd36b" />
          <stop offset="38%" stopColor="#e9953a" />
          <stop offset="62%" stopColor="#2f9e96" />
          <stop offset="100%" stopColor="#0b4f58" />
        </radialGradient>
        <linearGradient id={id('lip')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffe29a" />
          <stop offset="55%" stopColor="#8fe6d4" />
          <stop offset="100%" stopColor="#1f9c9a" />
        </linearGradient>
        <linearGradient id={id('board')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#123a5e" />
          <stop offset="100%" stopColor="#1f5f8f" />
        </linearGradient>
        <filter id={id('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id={id('floor')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0d3f4a" stopOpacity="0" />
          <stop offset="30%" stopColor="#0f5a61" stopOpacity=".85" />
          <stop offset="70%" stopColor="#15857f" />
          <stop offset="100%" stopColor="#2fb3a8" />
        </linearGradient>
        <linearGradient id={id('floorLine')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#dffcf4" stopOpacity="0" />
          <stop offset="40%" stopColor="#dffcf4" stopOpacity=".45" />
          <stop offset="100%" stopColor="#dffcf4" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id={id('curtain')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bdf0e2" stopOpacity=".85" />
          <stop offset="45%" stopColor="#3fb9ad" stopOpacity=".75" />
          <stop offset="100%" stopColor="#eafcf6" stopOpacity=".6" />
        </linearGradient>
        <linearGradient id={id('foot')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="70%" stopColor="#04161c" stopOpacity="0" />
          <stop offset="100%" stopColor="#04161c" stopOpacity=".7" />
        </linearGradient>
        <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      {/* sky and the light */}
      <rect width="1600" height="900" fill={`url(#${id('sky')})`} />
      <rect width="1600" height="900" fill={`url(#${id('sun')})`} style={{ mixBlendMode: 'screen' }} />

      {/* distant headland, palms, a lit house on the cliff */}
      <path d="M0 470 C 120 420, 230 380, 330 392 C 430 404, 540 450, 660 506 L 0 512 Z" fill="#072530" />
      <path d="M0 496 C 90 470, 200 458, 300 468 C 420 480, 540 494, 700 510 L 0 514 Z" fill="#051c24" />
      <rect x="248" y="392" width="54" height="26" rx="2" fill="#0a2a33" />
      <path d="M244 394 L 275 376 L 306 394 Z" fill="#0a2a33" />
      <Windows points={[[260, 404], [276, 404], [292, 404], [268, 412], [284, 412]]} r={2.6} />
      <Palm x={120} y={470} h={200} lean={-18} scale={0.72} fill="#041820" />
      <Palm x={175} y={462} h={240} lean={22} scale={0.8} fill="#041820" />
      <Palm x={360} y={430} h={170} lean={14} scale={0.62} fill="#051c24" />
      <Palm x={420} y={440} h={200} lean={-12} scale={0.66} fill="#051c24" />

      {/* open sea, with a haze on the horizon so sky and water meet softly */}
      <rect x="0" y="505" width="1600" height="395" fill={`url(#${id('sea')})`} />
      <rect x="0" y="494" width="1600" height="26" fill="#e9a24a" opacity=".22" filter={`url(#${id('soft')})`} />
      {/* the sun's road across the water */}
      <path d="M1080 520 L 1240 520 L 1420 900 L 900 900 Z" fill="#f7c95c" opacity=".10" filter={`url(#${id('soft')})`} />
      <Glints points={[
        [1120, 548, 18], [1180, 566, 26], [1090, 590, 14], [1210, 612, 30], [1150, 640, 22],
        [1260, 668, 34], [1110, 700, 18], [1300, 730, 26], [980, 760, 16], [1200, 790, 40],
        [420, 600, 10], [520, 650, 12], [300, 700, 9], [640, 720, 14]
      ]} />

      {/* ---------------- the barrel ----------------
          Drawn back to front: the lit hollow, the curl over it, the floor of
          water in front of it, foam where they meet. The hollow is bounded by
          the inside edge of the lip, so the light reads as coming THROUGH the
          tube rather than sitting in front of it. */}
      <g style={{ animation: 'skin-drift 22s ease-in-out infinite', transformOrigin: '1300px 500px' }}>
        <ellipse cx="1320" cy="420" rx="300" ry="240" fill="#f7c95c" opacity=".35"
                 filter={`url(#${id('glow')})`} style={{ mixBlendMode: 'screen' }} />

        {/* the hollow — back wall of the barrel, lit from the far end */}
        <path
          d="M1072 430 C 1010 380, 1030 280, 1120 205 C 1250 105, 1450 90, 1600 108
             L 1600 700 C 1460 736, 1260 742, 1110 700 C 1052 630, 1050 520, 1072 430 Z"
          fill={`url(#${id('tube')})`}
        />
        {/* water lines following the curl — the texture that makes it water */}
        <g fill="none" stroke="#fff4d6" strokeLinecap="round">
          <path d="M1100 420 C 1080 330, 1140 250, 1250 205 C 1360 165, 1480 160, 1600 172" strokeOpacity=".22" strokeWidth="2" />
          <path d="M1120 470 C 1110 380, 1170 300, 1280 262 C 1390 226, 1500 226, 1600 238" strokeOpacity=".16" strokeWidth="2" />
          <path d="M1150 540 C 1150 450, 1220 370, 1330 340 C 1430 314, 1520 318, 1600 330" strokeOpacity=".12" strokeWidth="2" />
          <path d="M1600 420 C 1520 420, 1420 440, 1360 500 C 1310 552, 1300 610, 1320 690" strokeOpacity=".12" strokeWidth="2" />
        </g>

        {/* the curtain — the lip pouring back down, closing the barrel's mouth */}
        <path
          d="M1010 424 C 1030 446, 1072 440, 1082 432 C 1092 520, 1104 610, 1120 704
             C 1080 712, 1040 712, 1000 706 C 986 610, 988 510, 1010 424 Z"
          fill={`url(#${id('curtain')})`}
        />
        <path d="M1012 440 C 998 520, 996 610, 1004 700" fill="none" stroke="#f3fffb" strokeOpacity=".35" strokeWidth="2" />

        {/* the curl, catching the sun on its outer edge */}
        <path
          d="M1600 58 C 1470 36, 1250 58, 1102 164 C 982 250, 948 372, 1010 424
             C 1034 444, 1062 446, 1082 432 C 1016 382, 1034 282, 1122 208
             C 1252 110, 1450 94, 1600 110 Z"
          fill={`url(#${id('lip')})`}
        />
        <path
          d="M1010 424 C 948 372, 982 250, 1102 164 C 1250 58, 1470 36, 1600 58"
          fill="none" stroke="#fffaf0" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round"
        />

        {/* the floor of the wave in front of the hollow */}
        <path
          d="M420 660 C 700 668, 960 704, 1110 700 C 1260 742, 1460 736, 1600 700
             L 1600 900 L 420 900 Z"
          fill={`url(#${id('floor')})`}
        />
        <path
          d="M700 674 C 880 690, 1010 712, 1110 700 C 1260 742, 1460 736, 1600 700"
          fill="none" stroke={`url(#${id('floorLine')})`} strokeWidth="3"
        />
        {/* foam ball where the lip lands */}
        <ellipse cx="1060" cy="690" rx="120" ry="34" fill="#effdf8" opacity=".28" filter={`url(#${id('soft')})`} />

        {/* spray off the lip */}
        <g fill="#fff6dc">
          {[
            [1000, 402, 3], [985, 380, 2], [1018, 440, 2.4], [1040, 452, 1.8], [970, 350, 1.6],
            [1060, 470, 2], [995, 460, 1.4], [1075, 488, 1.6], [955, 330, 1.2], [1030, 490, 1.2]
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r}
                    style={{ animation: `skin-twinkle ${2 + (i % 3)}s ease-in-out ${(i % 4) * 0.4}s infinite` }} />
          ))}
        </g>

        {/* the solar board, carving across the floor of the barrel */}
        <g transform="translate(1230 668) rotate(-14)">
          <path d="M-190 0 C -150 -28, 150 -32, 200 -5 C 150 22, -150 24, -190 0 Z"
                fill={`url(#${id('board')})`} stroke="#bfe9ff" strokeOpacity=".55" strokeWidth="1.5" />
          <g stroke="#9fd3f5" strokeOpacity=".5" strokeWidth="1">
            {[-130, -88, -46, -4, 38, 80, 122].map((x) => (
              <line key={x} x1={x} y1="-19" x2={x} y2="17" />
            ))}
            <line x1="-165" y1="-1" x2="178" y2="-3" />
          </g>
          <path d="M-120 -15 C -30 -25, 80 -22, 150 -10" fill="none" stroke="#fff3c4" strokeOpacity=".6" strokeWidth="2" />
          <path d="M-190 4 C -230 10, -262 8, -300 -2" fill="none" stroke="#f3fffb" strokeOpacity=".6" strokeWidth="7" strokeLinecap="round" />
          <path d="M-196 12 C -236 22, -280 22, -320 14" fill="none" stroke="#f3fffb" strokeOpacity=".3" strokeWidth="4" strokeLinecap="round" />
        </g>
      </g>

      {/* dark foot of the frame, so whatever sits at the bottom stays readable */}
      <rect x="0" y="0" width="1600" height="900" fill={`url(#${id('foot')})`} />
    </svg>
  );
};

/* ========================================================================== *
 * SCENE: THE COVE — the Sandbox and Clients
 * ========================================================================== */

/**
 * A cove at dusk: palms both sides, a house on the headland, the sun setting
 * into the sea. Darker than the barrel on purpose — these pages are dense with
 * panels and numbers, so the scene is a place rather than an event.
 */
export const ScenePalms = ({ className = '', style = null }) => {
  const u = useUid();
  const id = (n) => `${u}${n}`;
  return (
    <svg className={className} style={style} viewBox="0 0 1600 900"
         preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#051920" />
          <stop offset="42%" stopColor="#0c3441" />
          <stop offset="66%" stopColor="#3a3f3f" />
          <stop offset="82%" stopColor="#a4592a" />
          <stop offset="100%" stopColor="#e89a3c" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.66" cy="0.60" r="0.5">
          <stop offset="0%" stopColor="#fff0c2" />
          <stop offset="18%" stopColor="#ffc860" stopOpacity=".9" />
          <stop offset="45%" stopColor="#e27a28" stopOpacity=".45" />
          <stop offset="100%" stopColor="#e27a28" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('sea')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a5a33" />
          <stop offset="10%" stopColor="#1b4a52" />
          <stop offset="60%" stopColor="#082a33" />
          <stop offset="100%" stopColor="#041419" />
        </linearGradient>
        <filter id={id('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <linearGradient id={id('road')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity=".32" />
          <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill={`url(#${id('sky')})`} />
      <rect width="1600" height="900" fill={`url(#${id('sun')})`} style={{ mixBlendMode: 'screen' }} />
      {/* the sun, half into the sea */}
      <circle cx="1056" cy="560" r="46" fill="#fff1c9" opacity=".92" />

      {/* far hills */}
      <path d="M520 570 C 620 540, 760 522, 860 548 C 900 558, 930 566, 960 570 Z" fill="#12323a" opacity=".85" />
      <path d="M1130 570 C 1210 548, 1330 526, 1460 530 C 1530 532, 1580 540, 1600 544 L 1600 570 Z" fill="#0f2c33" opacity=".9" />

      {/* sea */}
      <rect x="0" y="566" width="1600" height="334" fill={`url(#${id('sea')})`} />
      <path d="M1016 568 L 1096 568 L 1260 900 L 850 900 Z" fill={`url(#${id('road')})`} filter={`url(#${id('soft')})`} />
      <Glints points={[
        [1050, 590, 22], [1070, 612, 30], [1030, 640, 18], [1090, 668, 36], [1045, 700, 26],
        [1110, 735, 40], [1000, 770, 22], [1140, 810, 44], [760, 640, 10], [640, 700, 12], [1320, 690, 12]
      ]} />
      {/* soft swell lines */}
      <g fill="none" stroke="#9fe0d6" strokeOpacity=".10" strokeWidth="2">
        <path d="M0 700 C 300 690, 600 712, 900 700 S 1400 690, 1600 704" />
        <path d="M0 760 C 320 748, 640 772, 960 760 S 1420 748, 1600 764" />
        <path d="M0 830 C 340 818, 700 842, 1000 830 S 1450 818, 1600 834" />
      </g>

      {/* left headland with the house */}
      <path d="M0 470 C 140 440, 260 440, 360 470 C 440 494, 500 540, 540 590 L 0 610 Z" fill="#051a21" />
      <rect x="200" y="436" width="96" height="40" rx="3" fill="#081f27" />
      <path d="M192 440 L 248 410 L 304 440 Z" fill="#081f27" />
      <Windows points={[[216, 452], [236, 452], [256, 452], [276, 452], [226, 464], [266, 464]]} r={3} />
      <Palm x={70} y={500} h={330} lean={34} scale={0.95} fill="#031217" />
      <Palm x={150} y={490} h={250} lean={-20} scale={0.78} fill="#041419" />
      <Palm x={360} y={500} h={200} lean={18} scale={0.66} fill="#051a21" />

      {/* right-hand palms, framing */}
      <path d="M1300 900 C 1330 760, 1380 650, 1470 612 C 1520 596, 1570 594, 1600 598 L 1600 900 Z" fill="#031217" />
      <Palm x={1520} y={640} h={420} lean={-60} scale={1.05} fill="#021015" />
      <Palm x={1440} y={660} h={300} lean={-26} scale={0.82} fill="#031217" />

      {/* dark floor for the content that sits over the lower half */}
      <rect x="0" y="0" width="1600" height="900" fill="#04161c" opacity=".18" />
    </svg>
  );
};

/* ========================================================================== *
 * SCENE: THE HUT — The Beach
 * ========================================================================== */

/**
 * Dusk at a beach hut: string lights, a neon wave on the wall, a fire, boards
 * leaning on the rail, and three batteries glowing by the door. The Beach is
 * where reps see what they have earned, so this is the warmest of the three.
 */
export const SceneBeach = ({ className = '', style = null }) => {
  const u = useUid();
  const id = (n) => `${u}${n}`;
  const bulbs = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = 760 + t * 700;
    const y = 250 + Math.sin(t * Math.PI) * 60;
    bulbs.push([x, y]);
  }
  return (
    <svg className={className} style={style} viewBox="0 0 1600 900"
         preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a2230" />
          <stop offset="40%" stopColor="#1f3d4a" />
          <stop offset="62%" stopColor="#8a4a2c" />
          <stop offset="80%" stopColor="#e6893a" />
          <stop offset="100%" stopColor="#f5b24c" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.28" cy="0.62" r="0.55">
          <stop offset="0%" stopColor="#fff0c0" />
          <stop offset="18%" stopColor="#ffc15a" stopOpacity=".95" />
          <stop offset="50%" stopColor="#ea8632" stopOpacity=".45" />
          <stop offset="100%" stopColor="#e27a28" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('sand')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2a22" />
          <stop offset="100%" stopColor="#140f0c" />
        </linearGradient>
        <linearGradient id={id('wall')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2b1d16" />
          <stop offset="100%" stopColor="#1a120e" />
        </linearGradient>
        <radialGradient id={id('fire')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff1b0" />
          <stop offset="30%" stopColor="#ffb341" stopOpacity=".9" />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('road')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity=".38" />
          <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
        </linearGradient>
        <filter id={id('bloom')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={id('neon')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect width="1600" height="900" fill={`url(#${id('sky')})`} />
      <rect width="1600" height="900" fill={`url(#${id('sun')})`} style={{ mixBlendMode: 'screen' }} />
      <circle cx="450" cy="560" r="40" fill="#fff0c4" opacity=".9" />

      {/* sea and the far headland */}
      <path d="M0 560 C 120 530, 260 520, 340 540 C 380 552, 410 566, 440 575 L 0 575 Z" fill="#1c2a2c" opacity=".9" />
      <rect x="0" y="572" width="1600" height="80" fill="#1d3a40" />
      <path d="M410 574 L 490 574 L 600 652 L 300 652 Z" fill={`url(#${id('road')})`} />
      <Glints points={[[420, 590, 20], [470, 606, 26], [440, 626, 18], [500, 640, 30], [300, 612, 12], [620, 620, 14]]} />

      {/* sand */}
      <path d="M0 640 C 300 620, 700 630, 1000 640 C 1250 648, 1450 640, 1600 632 L 1600 900 L 0 900 Z"
            fill={`url(#${id('sand')})`} />

      {/* palms behind the hut */}
      <Palm x={690} y={660} h={420} lean={40} scale={1} fill="#0b0a09" />
      <Palm x={1560} y={650} h={380} lean={-50} scale={0.95} fill="#0b0a09" />
      <Palm x={90} y={700} h={300} lean={30} scale={0.85} fill="#0b0a09" />

      {/* the hut */}
      <path d="M800 330 L 1150 250 L 1520 330 L 1520 360 L 800 360 Z" fill="#150e0b" />
      <rect x="840" y="360" width="640" height="300" fill={`url(#${id('wall')})`} />
      {/* planks */}
      <g stroke="#000" strokeOpacity=".22">
        {Array.from({ length: 16 }, (_, i) => (
          <line key={i} x1={840 + i * 40} y1="360" x2={840 + i * 40} y2="660" />
        ))}
      </g>
      {/* lit windows */}
      <rect x="880" y="420" width="120" height="90" rx="4" fill="#ffb95a" opacity=".85" />
      <rect x="880" y="420" width="120" height="90" rx="4" fill="#ffd89a" opacity=".5" filter={`url(#${id('bloom')})`} />
      <rect x="1330" y="420" width="110" height="90" rx="4" fill="#ffb95a" opacity=".8" />
      <rect x="1330" y="420" width="110" height="90" rx="4" fill="#ffd89a" opacity=".45" filter={`url(#${id('bloom')})`} />
      {/* doorway */}
      <rect x="1030" y="460" width="80" height="200" fill="#ff9d3f" opacity=".55" />

      {/* the neon wave */}
      <g filter={`url(#${id('neon')})`} fill="none" stroke="#5ff5e6" strokeWidth="7" strokeLinecap="round">
        <path d="M1150 470 C 1170 420, 1230 395, 1275 420 C 1300 434, 1300 470, 1270 476 C 1250 480, 1238 462, 1250 448" />
        <path d="M1140 495 C 1180 488, 1230 498, 1300 488" />
      </g>

      {/* string lights */}
      <path d={`M ${bulbs.map(([x, y]) => `${x} ${y}`).join(' L ')}`} fill="none" stroke="#2a1a12" strokeWidth="2" />
      <g>
        {bulbs.map(([x, y], i) => (
          <g key={i} style={{ animation: `skin-twinkle ${4 + (i % 3)}s ease-in-out ${(i % 5) * 0.5}s infinite` }}>
            <circle cx={x} cy={y + 8} r="11" fill="#ffcf6b" opacity=".45" filter={`url(#${id('bloom')})`} />
            <circle cx={x} cy={y + 8} r="4" fill="#fff0c4" />
          </g>
        ))}
      </g>

      {/* deck rail */}
      <rect x="800" y="640" width="720" height="16" fill="#0f0a08" />

      {/* three batteries by the door — the product, glowing quietly */}
      {[1175, 1225, 1275].map((x, i) => (
        <g key={x}>
          <rect x={x} y="560" width="38" height="92" rx="6" fill="#dfe8ea" opacity=".88" />
          <rect x={x + 17} y="572" width="4" height="66" rx="2" fill="#3fe0d4" />
          <rect x={x + 12} y="568" width="14" height="74" rx="6" fill="#3fe0d4" opacity=".35"
                filter={`url(#${id('bloom')})`} style={{ animation: `skin-twinkle ${5 + i}s ease-in-out infinite` }} />
        </g>
      ))}

      {/* boards against the rail */}
      <g>
        <path d="M772 660 C 752 560, 764 440, 790 380 C 816 440, 822 560, 806 660 Z" fill="#2f7d86" />
        <path d="M812 664 C 794 570, 804 460, 828 404 C 852 462, 858 570, 844 664 Z" fill="#c9a86a" />
        <path d="M1346 664 C 1330 580, 1338 490, 1360 440 C 1382 490, 1388 580, 1376 664 Z" fill="#9c5a3c" />
      </g>

      {/* the fire */}
      <ellipse cx="1000" cy="770" rx="170" ry="60" fill="#ff8a2a" opacity=".22" filter={`url(#${id('bloom')})`} />
      <ellipse cx="1000" cy="785" rx="120" ry="26" fill="#2a1d17" />
      <ellipse cx="1000" cy="780" rx="96" ry="18" fill="#140d0a" />
      <circle cx="1000" cy="752" r="60" fill={`url(#${id('fire')})`}
              style={{ animation: 'skin-twinkle 2.6s ease-in-out infinite' }} />
      <path d="M980 780 C 960 740, 990 720, 1000 690 C 1010 720, 1040 740, 1020 780 Z" fill="#ffd36b" opacity=".9" />
    </svg>
  );
};

/* ========================================================================== *
 * CARD ART — the small pictures on the Home and Beach cards
 * ========================================================================== */

/**
 * One small illustrated scene per card, keyed by name. Same rule as the big
 * scenes: dark with one light, so a title can sit across the bottom.
 */
export const CardArt = ({ kind = 'house', className = '', style = null }) => {
  const u = useUid();
  const id = (n) => `${u}${n}`;
  const sky = (
    <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#0b2d3a" />
      <stop offset="55%" stopColor="#6a4430" />
      <stop offset="100%" stopColor="#f0a13f" />
    </linearGradient>
  );
  const body = {
    // A home with a full solar roof at golden hour.
    house: (
      <>
        <rect width="400" height="240" fill={`url(#${id('sky')})`} />
        <circle cx="300" cy="150" r="26" fill="#fff0c2" opacity=".9" />
        <rect y="176" width="400" height="64" fill="#0a2630" />
        <Palm x={40} y={200} h={150} lean={16} scale={0.5} fill="#041419" />
        <Palm x={362} y={206} h={130} lean={-14} scale={0.45} fill="#041419" />
        {/* the roof face, and a grid of panels clipped to it so they sit ON it */}
        <path d="M112 150 L 158 104 L 242 104 L 288 150 Z" fill="#12222b" />
        <clipPath id={id('roof')}><path d="M122 146 L 162 108 L 238 108 L 278 146 Z" /></clipPath>
        <g clipPath={`url(#${id('roof')})`}>
          <rect x="112" y="104" width="176" height="46" fill="#1d4f7a" />
          <g stroke="#8fc6ef" strokeOpacity=".55" strokeWidth=".9">
            {[118, 127, 136].map((y) => <line key={y} x1="100" y1={y} x2="300" y2={y} />)}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={i} x1={130 + i * 18} y1="146" x2={146 + i * 13} y2="108" />
            ))}
          </g>
          <path d="M130 116 L 270 112" stroke="#fff3c4" strokeOpacity=".5" strokeWidth="2" />
        </g>
        <rect x="124" y="150" width="152" height="54" fill="#1a1512" />
        <rect x="140" y="164" width="30" height="22" fill="#ffc46b" />
        <rect x="230" y="164" width="30" height="22" fill="#ffc46b" />
        <rect x="188" y="170" width="24" height="34" fill="#ff9d45" opacity=".8" />
      </>
    ),
    // Storage: a battery on the wall, glowing, the house behind it.
    storage: (
      <>
        <rect width="400" height="240" fill={`url(#${id('sky')})`} />
        <rect y="170" width="400" height="70" fill="#081f27" />
        <path d="M40 130 L 150 70 L 260 130 Z" fill="#11232b" />
        <rect x="56" y="130" width="188" height="80" fill="#1b1714" />
        <rect x="76" y="148" width="40" height="28" fill="#ffc46b" />
        <rect x="180" y="148" width="40" height="28" fill="#ffc46b" />
        {[270, 316].map((x) => (
          <g key={x}>
            <rect x={x} y="98" width="38" height="112" rx="7" fill="#e5eef0" />
            <rect x={x + 17} y="112" width="4" height="84" rx="2" fill="#3fe0d4" />
            <rect x={x + 8} y="104" width="22" height="100" rx="8" fill="#3fe0d4" opacity=".25" />
          </g>
        ))}
        <path d="M252 150 L 244 172 L 256 172 L 248 194" fill="none" stroke="#ffd36b" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    // Clients: a street of rooftops, some already solar, lights coming on.
    clients: (
      <>
        <rect width="400" height="240" fill={`url(#${id('sky')})`} />
        <rect y="190" width="400" height="50" fill="#07202a" />
        {[[10, 150, 80], [100, 136, 90], [200, 146, 84], [290, 132, 100]].map(([x, y, w], i) => (
          <g key={i}>
            <path d={`M ${x} ${y + 14} L ${x + w / 2} ${y - 14} L ${x + w} ${y + 14} Z`} fill="#0f2129" />
            <rect x={x + 6} y={y + 14} width={w - 12} height={190 - y - 14} fill="#171310" />
            {i % 2 === 0 && (
              <path d={`M ${x + 14} ${y + 8} L ${x + w / 2} ${y - 8} L ${x + w - 14} ${y + 8} Z`}
                    fill="#1d4f7a" stroke="#8fc6ef" strokeOpacity=".45" strokeWidth=".8" />
            )}
            <rect x={x + 14} y={y + 28} width="16" height="14" fill="#ffc46b" opacity=".9" />
            <rect x={x + w - 30} y={y + 28} width="16" height="14" fill="#ffc46b" opacity=".7" />
          </g>
        ))}
        {/* a pin over the street */}
        <g transform="translate(236 70)">
          <path d="M0 26 C -14 10, -14 -2, 0 -10 C 14 -2, 14 10, 0 26 Z" fill="#3fe0d4" />
          <circle cx="0" cy="2" r="5" fill="#062026" />
        </g>
      </>
    ),
    // The Beach: boards, sun, a wave.
    beach: (
      <>
        <rect width="400" height="240" fill={`url(#${id('sky')})`} />
        <circle cx="110" cy="150" r="30" fill="#fff0c2" opacity=".9" />
        <rect y="168" width="400" height="30" fill="#15424c" />
        <path d="M0 198 C 100 188, 300 204, 400 194 L 400 240 L 0 240 Z" fill="#241913" />
        <path d="M210 196 C 196 130, 204 70, 222 34 C 240 70, 246 130, 236 196 Z" fill="#2f7d86" />
        <path d="M250 200 C 238 140, 244 90, 262 58 C 280 90, 286 140, 276 200 Z" fill="#c9a86a" />
        <path d="M290 202 C 280 150, 286 110, 302 84 C 318 110, 322 150, 314 202 Z" fill="#9c5a3c" />
        <Palm x={360} y={206} h={150} lean={-18} scale={0.48} fill="#0b0a09" />
      </>
    ),
    // Beach tiles
    // Pipeline is also the most famous break in surfing: a barrel.
    pipeline: (
      <>
        <rect width="400" height="240" fill="#0a3440" />
        <rect width="400" height="240" fill={`url(#${id('tubeLight')})`} style={{ mixBlendMode: 'screen' }} />
        <path d="M400 240 L 400 30 C 320 20, 220 40, 170 100 C 140 140, 160 180, 200 176
                 C 230 172, 220 140, 240 124 C 290 90, 360 120, 360 170 L 360 240 Z" fill="#17a19c" />
        <path d="M240 124 C 290 90, 360 120, 360 170 L 360 240 L 230 240 C 212 200, 214 150, 240 124 Z"
              fill={`url(#${id('hollow')})`} />
        <path d="M400 30 C 320 20, 220 40, 170 100 C 140 140, 160 180, 200 176" fill="none"
              stroke="#effdf8" strokeOpacity=".75" strokeWidth="4" strokeLinecap="round" />
        <rect y="206" width="400" height="34" fill="#0b4a50" opacity=".85" />
      </>
    ),
    // Where you are heading: a rising sun and the path up to it.
    forecast: (
      <>
        <rect width="400" height="240" fill={`url(#${id('sky')})`} />
        <circle cx="300" cy="150" r="34" fill="#fff0c2" opacity=".92" />
        <g stroke="#ffe3a0" strokeOpacity=".35" strokeWidth="2">
          {[-70, -45, -20, 5, 30].map((a) => {
            const r = (a * Math.PI) / 180;
            return <line key={a} x1={300 + Math.sin(r) * 46} y1={150 - Math.cos(r) * 46}
                         x2={300 + Math.sin(r) * 80} y2={150 - Math.cos(r) * 80} />;
          })}
        </g>
        <rect y="166" width="400" height="74" fill="#0c3038" />
        <path d="M40 200 C 110 196, 170 170, 220 140 C 250 122, 270 116, 290 112" fill="none"
              stroke="#3fe0d4" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
        {[[40, 200], [130, 184], [220, 140]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="5" fill="#3fe0d4" />
        ))}
      </>
    ),
    treasure: (
      <>
        <rect width="400" height="240" fill="#1b120d" />
        <ellipse cx="200" cy="170" rx="160" ry="60" fill="#ff8a2a" opacity=".25" />
        <ellipse cx="200" cy="190" rx="90" ry="20" fill="#2a1d17" />
        <circle cx="200" cy="158" r="44" fill="#ffb341" opacity=".55" />
        <path d="M184 190 C 170 160, 192 140, 200 118 C 208 140, 230 160, 216 190 Z" fill="#ffd36b" />
      </>
    ),
    // How the book is trending: sets of swell rolling in.
    swell: (
      <>
        <rect width="400" height="240" fill="#0b2d3a" />
        <circle cx="330" cy="70" r="28" fill="#ffd36b" opacity=".9" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M0 ${120 + i * 30} C 80 ${100 + i * 30}, 160 ${140 + i * 30}, 240 ${118 + i * 30} S 360 ${100 + i * 30}, 400 ${116 + i * 30}`}
                fill="none" stroke="#3fe0d4" strokeOpacity={0.75 - i * 0.14} strokeWidth="4" strokeLinecap="round" />
        ))}
      </>
    ),
    quiver: (
      <>
        <rect width="400" height="240" fill="#1c2a30" />
        {[['#2f7d86', 110], ['#c9a86a', 170], ['#9c5a3c', 230], ['#e5eef0', 290]].map(([c, x], i) => (
          <path key={i} d={`M ${x} 230 C ${x - 16} 150, ${x - 8} 70, ${x + 10} 20 C ${x + 28} 70, ${x + 34} 150, ${x + 22} 230 Z`}
                fill={c} opacity=".92" />
        ))}
      </>
    )
  }[kind];

  return (
    <svg className={className} style={style} viewBox="0 0 400 240"
         preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {sky}
        <radialGradient id={id('tubeLight')} cx="0.78" cy="0.62" r="0.5">
          <stop offset="0%" stopColor="#ffd36b" stopOpacity=".9" />
          <stop offset="100%" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('hollow')} cx="0.6" cy="0.55" r="0.6">
          <stop offset="0%" stopColor="#fff4d0" />
          <stop offset="35%" stopColor="#f7c95c" />
          <stop offset="75%" stopColor="#e28a36" />
          <stop offset="100%" stopColor="#1a8a86" />
        </radialGradient>
      </defs>
      {body || null}
    </svg>
  );
};

export default { SceneWave, ScenePalms, SceneBeach, CardArt, Palm };
