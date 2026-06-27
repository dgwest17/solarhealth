# Rep Login & Roles — Setup

How the SolarHealth monitoring portal decides who someone is when they log in,
and how to add rep accounts. Everyone uses the **same login screen**; the server
decides what each person can see based on their role.

## The three roles

| Role | Who | Sees |
|------|-----|------|
| **admin** | You. Email listed in `ADMIN_EMAILS`. | All clients + Sandbox |
| **rep** | Email exists in Zoho **Recruits** with `Engineer = true`. | A shared test client + Sandbox |
| **client** | Any other logged-in email. | Only their own record (matched by email) |

Roles are resolved **server-side** from the verified login token. The browser
cannot change its own role — there is no way for a rep or client to grant
themselves admin by editing anything in the browser.

## How role resolution works

On every API request, `api/_auth.js`:

1. Verifies the Supabase login token (rejects forged/expired sessions).
2. Reads the verified email.
3. Resolves the role, in this order:
   - Email in `ADMIN_EMAILS` → **admin**
   - Else: look the email up in Zoho **Recruits**; if `Engineer == true` → **rep**
   - Else → **client**

**Recruits is the single source of truth for who is a rep.** Flag someone
`Engineer = true` in Zoho and they become a rep on their next login — no code
change, no redeploy.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**
(Production environment). Redeploy after changing any of them.

| Variable | Sensitive? | Purpose |
|----------|-----------|---------|
| `ADMIN_EMAILS` | Yes | Comma-separated admin emails (your login). |
| `REP_TEST_CLIENT_EMAIL` | Yes | Email of the Contact every rep sees as their demo/test client. **Reps see an empty list until this is set.** |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Yes | Server-side token verification. |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | Yes | Zoho API access (refresh token must include `ZohoCRM.coql.READ`). |

`REP_TEST_CLIENT_EMAIL` example: point it at your West test contact
(`Speedwest7@gmail.com`) or a dedicated demo Contact.

## Adding a rep (step by step)

1. **Flag them in Zoho.** In Recruits, open the rep's record and set
   `Engineer = true`. Make sure their `Email` is correct — it's the link
   between their login and their rep status.
2. **Create their login in Supabase.** Supabase → Authentication → Users →
   Add user. Use the **same email** as their Recruits record, set a strong
   password (or send an invite).
3. **Done.** They log in at the normal screen. The server sees their email is
   an Engineer in Recruits and grants rep access automatically. They get the
   Sandbox tab and a Clients tab showing the shared test client.

## What a rep can and cannot do (current phase)

**Can:**
- Log in at the standard screen.
- Use the **Sandbox** (full audit + battery tools, no client attached).
- See and open the **one shared test client** (`REP_TEST_CLIENT_EMAIL`).

**Cannot:**
- See your real clients. The client list is scoped server-side; reps only get
  the test client.
- Open any other client by guessing an id — `api/client.js` returns **403**
  for any contact that isn't the designated test client.

## Coming later (not in this phase)

- **Write-back:** a rep's sandbox audit → "Save as new lead" → writes a new
  Contact + Solar_Project to your Zoho.
- **Ownership:** an owner field on records so each rep sees **their own**
  leads instead of one shared test client. The role plumbing
  (`role === 'rep'`) is already in place for this to hook into.
- **Per-rep test clients:** assign a different demo Contact per rep (a field on
  their Recruits record) instead of one shared `REP_TEST_CLIENT_EMAIL`.

## Files involved

| File | Role in the system |
|------|--------------------|
| `api/_auth.js` | Verifies token, resolves role (admin/rep/client) via Recruits. |
| `api/clients.js` | Returns the role-scoped client list. |
| `api/client.js` | Returns one client; enforces per-role access (403 on violation). |
| `src/App.jsx` | Routes login → dashboard/sandbox; learns role on load. |
| `src/components/ClientDashboard.jsx` | Renders the client list; labels the rep view. |

## Quick troubleshooting

- **Rep sees an empty client list** → `REP_TEST_CLIENT_EMAIL` isn't set (or no
  Contact has that email). Set it and redeploy.
- **Rep is treated as a plain client** → their login email doesn't match a
  Recruits record with `Engineer = true`. Check the email matches exactly and
  the Engineer box is checked.
- **Everyone is a client / nothing scopes** → the Recruits lookup is failing
  silently (falls back to client by design). Confirm the Zoho refresh token has
  `ZohoCRM.coql.READ` scope.
- **Changes not taking effect** → env var changes require a **redeploy** in
  Vercel.
