# SolarHealth

A California solar financial-audit platform for **Your Energy Best** (Beacon Energies LLC). It ingests a client's existing solar system details, reconstructs their financial history against real utility-rate curves and Net Energy Metering (NEM) rules, grades system health, and produces a personalized consultation report. It doubles as a battery/upsell engine — modeling storage economics hour by hour so a rep can show, honestly, whether adding a battery and switching rate plans pays off.

- **Live:** https://solarhealth.vercel.app
- **Repo:** https://github.com/dgwest17/solarhealth
- **Two audiences:** existing clients (personalized audit reports) and other solar companies (a white-labelable lead-gen/audit product).

---

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model & sources of truth](#data-model--sources-of-truth)
- [Directory layout](#directory-layout)
- [Core domain logic](#core-domain-logic)
- [Battery dispatch engine](#battery-dispatch-engine)
- [API endpoints](#api-endpoints)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Domain conventions & gotchas](#domain-conventions--gotchas)
- [Roadmap](#roadmap)

---

## What it does

A rep opens a client from the dashboard and the tool pulls that client's system from the CRM: system size, production, usage, utility, NEM version, financing, install/PTO date. From there it:

- **Reconstructs financial history** year by year from install to today, pricing each year against that utility's real historical rate (2010–2026) and the client's NEM rules, including CARE discounts.
- **Calculates the current NEM position** — annual netting for NEM 1.0/2.0, decoupled treatment for NEM 3.0 — surfacing whether the client is banking credits or facing a true-up bill.
- **Grades system health** via a performance ratio (actual vs. expected production) and an overall letter grade, with a hard "Critical" rule when the annual true-up is severe.
- **Models battery economics** hour-by-hour across 12 months: what storage is worth for this specific client, which rate plan to switch to, which hardware to pick, and — critically — what a battery *cannot* fix.
- **Generates a consultation report** (HTML) with charts, the savings history, the NEM breakdown, battery scenarios, and an optional AI-written narrative summary, emailed to the client as an attachment.

Everything a rep edits writes back to the CRM, so the audit tool doubles as data entry for a client base that's still being filled in.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Charts | Recharts |
| Icons | lucide-react |
| Auth & persistence | Supabase (`@supabase/supabase-js`) |
| CRM / source of truth | Zoho CRM (Contacts + Solar_Projects modules) |
| Transactional email | ZeptoMail (primary), Resend (fallback) |
| AI narratives | Anthropic API (Claude Sonnet) |
| Hosting | Vercel (serverless functions under `/api`) |

---

## Architecture

The frontend is a single-page React app. All privileged work — CRM reads/writes, email, AI calls — happens in Vercel serverless functions under `/api`, so no secrets ever reach the browser. The browser only holds the Supabase anon key (via `VITE_` vars) for auth and per-client settings persistence.

```
Browser (React SPA)
   │  auth + per-client settings          │  audit reads/writes, email, AI
   ▼                                       ▼
Supabase  ◄─────────────────────►  Vercel /api functions
(auth, client_data table)                 │
                                          ▼
                             Zoho CRM (Contacts, Solar_Projects)
                             ZeptoMail / Resend (email)
                             Anthropic API (report narrative)
```

- **Zoho** is the system of record for client and project data.
- **Supabase** stores auth plus a `client_data` table for tool-only settings that don't belong in the CRM: consumption profile, Load Simulator loads, and battery rate overrides, keyed per client.

---

## Data model & sources of truth

**Zoho CRM — the source of truth.** Two modules:

- **Contacts** — the person. Name, email, phone, mailing address, plus tool-relevant fields: `Lifecycle_Stage`, `Ownership_Status`, `Created_By_Rep` (rep ownership), `Left_Review`, `Send_Annual_Report`.
- **Solar_Projects** — the system, linked to a Contact via the **`Contact` lookup**. Holds `System_Size_kW`, `Annual_System_Production`, `Current_Annual_Usage_kWh`, `Utility_Provider`, `NEM_Version`, `Purchase_Type`, `Finance_Provider`, `Project_Status`, `Opportunity_Type`, `PTO_Date`, `Install_Date`, and more.

**Empty means empty.** If a field is blank in Zoho, the tool shows `—` (or "— not set —" on dropdowns) and lists it in a "Missing from the CRM" banner. The API never invents defaults — a rep filling in real data must never be shown a fabricated number they might trust. Blank inputs stay blank end-to-end rather than becoming `NaN` or a placeholder value.

**Supabase `client_data`** — tool-only settings persisted per contact so they survive reloads: Load Simulator loads, consumption profile, and battery rate overrides. These never touch the CRM.

---

## Directory layout

```
solarhealth/
├── api/                         # Vercel serverless functions (all secrets live here)
│   ├── _auth.js                 # shared auth guard
│   ├── _zoho.js                 # Zoho OAuth token refresh + request helper
│   ├── client.js                # read one client (project + contact) → audit inputs
│   ├── clients.js               # dashboard list
│   ├── create-client.js         # new client (sets sane lifecycle/ownership defaults)
│   ├── save-project.js          # write Solar_Projects fields (whitelisted)
│   ├── save-contact.js          # write Contacts fields (graceful field-absent fallback)
│   ├── gb-profile.js            # per-client tool settings (Supabase): loads, profile, rate override
│   ├── generate-narrative.js    # Anthropic API → personalized report summary
│   ├── send-audit.js            # ZeptoMail (Resend fallback) — emails the report
│   ├── mark-report-sent.js      # stamp Send_Annual_Report / sent status
│   └── health.js                # health check
├── src/
│   ├── App.jsx                  # top-level routing: auth gates, dashboard, client tool
│   ├── SolarCalculator.jsx      # the audit tool — wiring hub for every child panel
│   ├── components/              # dashboard, input form, results, report, modals, auth screens
│   ├── battery/                 # battery analysis + the hour-by-hour dispatch engine
│   ├── simulator/               # Load Simulator (future loads, EV-vs-gas)
│   ├── greenbutton/             # Green Button (utility interval data) parser + upload
│   ├── report/                  # ConsultationReport.js — the HTML report builder
│   ├── tech/                    # systemScore, equipment data, incentives
│   ├── utils/                   # calculations, rateData, loan math, narrative prompt
│   ├── hooks/useAuth.js         # Supabase auth + password-recovery event handling
│   ├── config/                  # branding, tooltip copy
│   ├── constants/defaults.js    # default inputs, thresholds, picklists
│   └── lib/supabaseClient.js
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

> **Why `SolarCalculator.jsx` changes so often:** it's the wiring hub. Every child panel (battery, simulator, report) reaches the others only through it, so any feature that needs data flowing in or out touches this file. It changes whenever a spoke gains a capability.

---

## Core domain logic

Lives in `src/utils/calculations.js`. Key exports:

- **`getUtilityRate(year, utility, care)`** — historical rate for a given year, interpolating/extrapolating outside the table; pre-2010 installs clamp to the 2010 rate rather than inventing history. CARE applies a 30% discount, including to back-history.
- **`calculateNEMPosition`** — the true-up engine. NEM 1.0 and 2.0 net the year out; NEM 3.0 is treated as decoupled. Connection fees: NEM 2.0/3.0 always incur ~$144/yr; NEM 1.0 only when the client ends up owing. Measured Green Button data, when present, overrides the modeled profile.
- **`getDegradedProduction`** — production adjusted for panel degradation over system age.
- **`calculateSystemScore`** — see below.
- **`calculateComprehensiveSavings`** — orchestrates the full year-by-year history and returns everything the dashboard, charts, and report render.

**Rate data** (`src/utils/rateData.js`) covers **2010–2026** for PG&E, SCE, SDG&E, and SMUD, plus TOU rate structures, EV-TOU plans, NEM/program picklists, and the finance-provider list. SDG&E 2010 = $0.136 is a known anchor; some early years are documented estimates (noted in the file header).

**System score** (`src/tech/systemScore.js`) is a single shared module so the in-app card and the report badge can never disagree. Hard rule: **annual true-up > $2,000 → grade F / "Critical"** (flashing red). Grades range up through A / "Excellent" and S / "SuperSolar".

---

## Battery dispatch engine

The most involved subsystem, in `src/battery/BatteryDispatch.js` (model) and `BatteryDispatchPanel.jsx` (UI). It simulates **24 hours × 12 months** with real seasonal solar and consumption shapes, then dispatches a battery under an explicit policy and settles it under the client's NEM rules.

**Core principle: a battery's value is a *spread*, not a gross.** Storage shifts energy in time; it does not create it. A home short 5,000 kWh/yr is still short 5,000 kWh/yr after a battery (slightly more, after round-trip losses). What changes is the *price* of those kWh — buying at super-off-peak instead of peak, and selling stored solar into the 4–9pm window instead of the midday trough. The panel says this plainly so nobody oversells storage.

What it models:

- **Three scenarios** — today (current plan, no battery), battery on the current plan, and battery + switch to EV-TOU-5 — with a per-client recommendation. The recommendation genuinely flips: overconsumers usually gain from EV-TOU-5's cheap midday window; heavy overproducers can be made *worse off* because that same switch guts their midday export credit.
- **A hardware catalog** (Tesla, Enphase, Franklin, SolarEdge, Lunar, Generac, Sonnen) with usable capacity, continuous output, round-trip efficiency, and coupling. Comparison ladders show **marginal value per added unit** and flag when a battery is "saturated — adds nothing" because surplus solar, not capacity, is the binding constraint.
- **The honest ceiling** — the energy gap before/after (it does not close), peak-priced kWh avoided, stored solar sold at peak, and seasonal solar-fill (a Powerwall fills ~51% in summer but ~13% in December). It names the binding constraint: solar, capacity, or balanced.
- **A compliance guardrail** — grid-charged energy is tracked separately and never counted as creditable export (CPUC requires exports be solar-origin). Grid-charged kWh serve the home but earn no export credit.
- **Manual rate override** — a switch reveals an editable buy/sell grid so a rep can enter the client's exact tariff (both buy and export-credit rates, seasonal). Blank fields fall back to the published schedule. Persisted per client.
- **Dispatch incentive programs** — e.g. **SDCP (San Diego Community Power)**: +$0.10/kWh on battery energy discharged during **weekday 4–9pm** events (to home or grid — *not* a flat export adder), plus a one-time upfront rebate ($350/kWh new, $250/kWh add-on, $10k cap, 5-yr enrollment). Modeled precisely, not as a blanket bonus.
- **Load Simulator integration** — planned new load (EV, etc.) folds into modeled usage so the battery is sized against the home's future consumption, not just today's.

---

## API endpoints

All under `/api`, Vercel serverless. Reads and writes go through Zoho via `_zoho.js` (OAuth refresh-token flow); tool settings go through Supabase.

| Endpoint | Purpose |
|---|---|
| `client.js` | Read one client — merges Solar_Projects + Contact into audit inputs, preserving nulls. PTO date primary, install date fallback. |
| `clients.js` | Dashboard list (filters on `Last_Name is not null` so email-less clients appear). |
| `create-client.js` | Create a client with sane lifecycle/ownership/opportunity defaults. |
| `save-project.js` | Write whitelisted Solar_Projects fields (status, opportunity, finance provider, etc.). |
| `save-contact.js` | Write Contacts fields, with retry-without-field fallback if a field doesn't exist yet. |
| `gb-profile.js` | Per-client tool settings in Supabase: Load Simulator loads, consumption profile, battery rate override. |
| `generate-narrative.js` | Calls the Anthropic API to write a personalized report summary. |
| `send-audit.js` | Emails the consultation report via ZeptoMail, Resend fallback. |
| `mark-report-sent.js` | Records that a report was sent / flags annual-report status. |
| `health.js` | Health check. |

---

## Environment variables

Set in Vercel (never committed). Server-side:

```
# Zoho CRM (OAuth refresh-token flow)
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
ZOHO_REFRESH_TOKEN
ZOHO_ACCOUNTS_DOMAIN
ZOHO_API_DOMAIN

# Supabase (server)
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY

# Email
ZEPTOMAIL_TOKEN
RESEND_API_KEY
EMAIL_FROM
EMAIL_COMPANY

# AI narratives
ANTHROPIC_API_KEY

# Access control / testing
ADMIN_EMAILS
REP_TEST_CLIENT_EMAIL
```

Client-side (exposed to the browser, safe by design):

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

## Local development

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build → dist/
npm run preview    # preview the build
npm run lint       # eslint
```

The frontend builds and runs without secrets, but any feature that hits `/api` needs the environment variables above (and the Vercel dev runtime for serverless functions).

**Deployment workflow note:** files are currently uploaded manually via the GitHub web UI (no CLI deploy). When editing, keep the build green and verify changed components render before uploading. Filenames are case-sensitive — imports like `./BatteryDispatchPanel` must match exactly.

---

## Deployment

- **Host:** Vercel, framework preset **Vite**, build `npm run build`, output `dist/` (see `vercel.json`).
- **Functions:** everything in `/api` deploys as serverless functions automatically.
- Password reset requires the Supabase dashboard **Site URL** to be set to the production URL (Authentication → URL Configuration), with the deployment URL in the redirect allow-list.

---

## Domain conventions & gotchas

- **NEM rules are nuanced.** NEM 1.0 overproducers owe no connection fees; NEM 2.0 always incurs ~$144/yr regardless of production; NEM 3.0 is fully decoupled. Get these wrong and the whole audit is wrong.
- **Average monthly savings** differs by financing: Cash = pure avoided utility cost; Loan/PPA = avoided utility minus the solar payment.
- **React hooks order matters.** Early returns must come *after* all hook declarations — an early return above a `useState` crashes with React error #300. This bit the password-reset flow historically.
- **Empty is not a default.** Blank Zoho fields render as `—`; the API never substitutes a plausible-looking number.
- **Rate lookups are guarded.** A blank utility falls back to a default curve so the tool renders instead of crashing, while the UI flags the missing field.
- **Battery exports must be solar-origin.** Grid-charged energy is never credited as export.
- **Program terms drift.** Utility rates and incentive programs (SDCP, SMUD) live in clearly labeled, editable blocks — they change every cycle and are meant to be one-line updates.

---

## Roadmap

- Complete the existing-client import and project→contact relinking in Zoho.
- Annual-report newsletter cron (batched daily, driven by a `Send_Annual_Report` flag).
- White-label "agency mode" — custom logo/colors for other solar companies.
- Custom domain pointed at the Vercel deployment.
- Payments (provider TBD) for the productized white-label offering.

---

*Internal project for Your Energy Best (Beacon Energies LLC). Not for public distribution.*
