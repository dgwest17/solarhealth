/**
 * FILE: api/[...path].js
 *
 * THE SINGLE FRONT DOOR.
 *
 * Vercel bills one Serverless Function per file in /api, and the Hobby plan
 * allows twelve. This platform has seventeen endpoints, which is a deployment
 * error, not a design problem — the endpoints themselves are fine. So every
 * handler now lives in api/_routes/ (Vercel ignores anything under a leading
 * underscore) and this one catch-all dispatches to them.
 *
 * Net effect: 17 functions -> 1. URLs are unchanged; /api/settings still
 * resolves to the settings handler, so nothing in src/ had to move.
 *
 * WHY A STATIC MAP AND NOT A DYNAMIC IMPORT. The obvious version of this file
 * builds a path from the request and imports it:
 *
 *     await import(`./_routes/${req.query.path}.js`)      // do not do this
 *
 * That hands the filesystem to the caller. `../../../etc/whatever` and similar
 * traversals become reachable, and on some bundlers an attacker-chosen
 * specifier can pull in a module that was never meant to be an endpoint. The
 * map below is exhaustive and explicit: a request either matches a key or gets
 * a 404, and there is no string that resolves to anything not listed here.
 *
 * The static imports also mean the bundler can see every handler at build
 * time. A dynamic specifier would leave it guessing, and the usual result is a
 * route that works locally and 500s in production because its module never got
 * bundled.
 *
 * COLD STARTS. One function means one container, so the handlers share it —
 * the first request pays for loading all of them, and subsequent requests pay
 * nothing. That is the right trade here: the alternative is not seventeen warm
 * functions, it is a deployment that does not happen.
 *
 * ADDING AN ENDPOINT: drop the file in api/_routes/ and add one line to ROUTES.
 * Forgetting the second step gives a 404, which is the obvious failure and is
 * much easier to diagnose than a traversal you did not know you shipped.
 */
import beach from './_routes/beach.js';
import client from './_routes/client.js';
import clients from './_routes/clients.js';
import createClient from './_routes/create-client.js';
import gbProfile from './_routes/gb-profile.js';
import generateNarrative from './_routes/generate-narrative.js';
import health from './_routes/health.js';
import intake from './_routes/intake.js';
import markReportSent from './_routes/mark-report-sent.js';
import projectSteps from './_routes/project-steps.js';
import quiverProgress from './_routes/quiver-progress.js';
import saveContact from './_routes/save-contact.js';
import saveProject from './_routes/save-project.js';
import saveProposal from './_routes/save-proposal.js';
import sendAudit from './_routes/send-audit.js';
import settings from './_routes/settings.js';
import uploadDoc from './_routes/upload-doc.js';

/**
 * The complete set of reachable endpoints. Keys are exactly the URL segment
 * after /api/, so this table doubles as the API's index.
 */
const ROUTES = {
  'beach': beach,
  'client': client,
  'clients': clients,
  'create-client': createClient,
  'gb-profile': gbProfile,
  'generate-narrative': generateNarrative,
  'health': health,
  'intake': intake,
  'mark-report-sent': markReportSent,
  'project-steps': projectSteps,
  'quiver-progress': quiverProgress,
  'save-contact': saveContact,
  'save-project': saveProject,
  'save-proposal': saveProposal,
  'send-audit': sendAudit,
  'settings': settings,
  'upload-doc': uploadDoc
};

export default async function handler(req, res) {
  // Vercel gives the catch-all as an array of segments; a bare string arrives
  // when there is exactly one. Only the first segment is a route name — every
  // endpoint here is flat, so a deeper path is a mistake rather than a nested
  // route, and is refused instead of being silently truncated to its head.
  const raw = req.query && req.query.path;
  const segments = Array.isArray(raw) ? raw : (raw ? [raw] : []);

  if (segments.length !== 1) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // Object.prototype keys ('constructor', '__proto__', 'toString') would
  // otherwise resolve to inherited properties and be called as handlers.
  const name = segments[0];
  const route = Object.prototype.hasOwnProperty.call(ROUTES, name)
    ? ROUTES[name]
    : null;

  if (typeof route !== 'function') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    return await route(req, res);
  } catch (err) {
    // A handler that throws past its own error handling would otherwise
    // surface as an opaque platform 500 with nothing in the logs tying it to
    // a route. Name the route; keep the detail server-side.
    console.error(`[api/${name}] unhandled:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error' });
    }
  }
}
