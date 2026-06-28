# Deploying ClearRoute (go-live runbook)

This repo (`dlmtthws-oss/fantastic-rotary-phone`) holds the current,
multi-tenant version of ClearRoute. The Supabase backend has **already** been
migrated to multi-tenant (strict per-company RLS, real-auth, per-company
settings), so the deployed front end **must** be this codebase.

> ⚠️ Important: the old `dlmtthws-oss/clearroute` repo (what the existing
> Vercel projects deploy today) is **not** compatible with the migrated
> database — it uses a demo login with no real Supabase session, so the new
> RLS blocks all of its data access. Retire it once this repo is live.

## 1. Point Vercel at this repo
In Vercel, use **one** project (recommended keeper: `clearroute` in team
`clear-route-2ee93d27`) and connect it to the `dlmtthws-oss/fantastic-rotary-phone`
repo, production branch `main`. (Or create a fresh project from this repo.)

Build settings are already defined in `vercel.json` (CRA):
- Framework: Create React App
- Build: `npm run build`  ·  Output: `build`

## 2. Set environment variables (Project → Settings → Environment Variables)
Required for the app to talk to Supabase:

```
REACT_APP_SUPABASE_URL=https://mskdxzknzblvmflsydjs.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<publishable anon key from Supabase → Project Settings → API>
```

(The anon key is a publishable client key — safe to expose in the browser
bundle. It is intentionally not committed here.)

## 3. Deploy & verify
Deploy `main`. Then smoke-test on the deployment URL (a real browser, where
egress works):
1. Landing → Pricing shows Solo/Team purchasable and **Business/AI "Coming soon"**.
2. **Sign up** a new business → you land in a brand-new, empty company (onboarding).
3. Add a customer, then sign up a **second** business → it sees none of the first's data.
4. Sign in / sign out works (the old demo "Continue as Admin" is gone by design).

`scratchpad/smoke.js` (Playwright) automates 1–2; point its `base` at the
deployment URL to run it from an environment that can reach Supabase.

## 4. Billing (only needed to sell paid tiers)
Follow `STRIPE_SETUP.md` — create the Team price, set the Edge Function
secrets, register the subscription webhook. Set `APP_URL` to the deployed
origin so Checkout return URLs are correct.

## 5. Retire the duplicates
- Delete the other 4 Vercel projects and the 2 spare duplicate "ClearRoute"
  teams (see the project audit) so there's one canonical deployment.
- Attach your custom domain (`clearroute.app`) to the keeper project.

## What works today vs. later
- **Sellable now:** Solo + Team — customers, rounds, jobs, invoicing, Direct
  Debit, card payments, quotes, customer portal, team. Multi-tenant + trial billing.
- **Coming soon (gated off):** Business (Xero/QuickBooks/Open Banking) and AI
  copilots — their integrations/functions need a dedicated build before sale.
