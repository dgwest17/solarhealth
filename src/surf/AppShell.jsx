/**
 * FILE: src/surf/AppShell.jsx
 *
 * THE FRAME EVERY SIGNED-IN PAGE SITS IN: a scene behind, the rail on the left,
 * the page on top.
 *
 * ---------------------------------------------------------------------------
 * THE SCENE IS FIXED, THE PAGE SCROLLS OVER IT
 *
 * The scene is pinned to the viewport and the page scrolls across it, so a long
 * audit reads as panels floating over the same place rather than a picture that
 * scrolls away after the first screen.
 *
 * Over it sits a SCRIM that is light at the top and dark lower down. The top of
 * each page is where the headline is, and the picture should be seen there;
 * everything below is dense panels of figures, which need a dark, quiet field or
 * the picture shows through them as noise. A panel reading a true-up figure over
 * a bright sunset is how a reskin makes an app worse.
 *
 * NOTHING HERE PRINTS. The scene and the rail are print:hidden, and the page
 * keeps its own print styles, so "Generate PDF" still produces white paper.
 *
 * Used by: src/App.jsx
 */
import React from 'react';
import { SceneWave, ScenePalms, SceneBeach } from './Scenes';
import { SideNav, TopNav, UserChip } from './Skin';
import { ART } from './art';

const SCENES = { wave: SceneWave, palms: ScenePalms, beach: SceneBeach };

/**
 * How much of the scene each page shows.
 *
 * `vivid` pages (Home, The Beach) are mostly picture with a few cards on it.
 * `calm` pages (the audit, the client list) are mostly numbers, so the scene
 * is there at the top and nearly gone behind the panels.
 */
const SCRIMS = {
  vivid: 'linear-gradient(180deg, rgba(4,20,26,0) 0%, rgba(4,20,26,.04) 45%, rgba(4,20,26,.32) 75%, rgba(4,20,26,.62) 100%)',
  calm:  'linear-gradient(180deg, rgba(4,20,26,.08) 0%, rgba(4,20,26,.30) 30%, rgba(4,20,26,.55) 60%, rgba(4,20,26,.74) 100%)'
};

export const Backdrop = ({ scene = 'palms', mood = 'calm' }) => {
  const Scene = SCENES[scene] || ScenePalms;
  const photo = ART[scene] || null;
  return (
    <div className="fixed inset-0 -z-10 print:hidden overflow-hidden" aria-hidden="true">
      {photo ? (
        <div className="absolute inset-0"
             style={{ backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      ) : (
        <Scene className="absolute inset-0 w-full h-full" />
      )}
      <div className="absolute inset-0" style={{ background: SCRIMS[mood] || SCRIMS.calm }} />
      {/* left-side darkening under the rail and the headline column */}
      <div className="absolute inset-0"
           style={{ background: 'linear-gradient(90deg, rgba(4,20,26,.38) 0%, rgba(4,20,26,0) 36%)' }} />
    </div>
  );
};

/**
 * @param items    Rail entries: { id, label, icon, view, sub? }.
 * @param view     The active view, to highlight its entry.
 * @param scene    'wave' | 'palms' | 'beach'.
 * @param mood     'vivid' | 'calm'.
 */
const AppShell = ({
  items = [], view, onNavigate, scene = 'palms', mood = 'calm',
  userEmail = '', role = null, onSignOut = null, children
}) => (
  <div className="skin isolate relative min-h-screen flex text-slate-200">
    <Backdrop scene={scene} mood={mood} />
    <SideNav
      items={items}
      view={view}
      onNavigate={onNavigate}
      footer={
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 px-1">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M6 22c3-9 11-14 20-14-2 9-8 15-17 16" fill="none" stroke="#3fe0d4" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 21c4-4 8-7 13-9" fill="none" stroke="#3fe0d4" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] leading-tight" style={{ color: '#82abb2' }}>
              Cleaner Energy<br />Brighter Tomorrows
            </span>
          </div>
          <UserChip email={userEmail} role={role} onSignOut={onSignOut} compact />
        </div>
      }
    />
    <div className="flex-1 min-w-0 flex flex-col">
      <TopNav
        items={items}
        view={view}
        onNavigate={onNavigate}
        right={onSignOut ? (
          <button
            onClick={onSignOut}
            className="px-2.5 py-1.5 rounded-lg text-[12px] shrink-0"
            style={{ background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.18)', color: '#fff' }}
          >
            Sign out
          </button>
        ) : null}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  </div>
);

export default AppShell;
