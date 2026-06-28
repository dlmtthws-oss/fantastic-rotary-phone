# Stripe subscription setup

ClearRoute bills subscriptions through Stripe Checkout + the Billing Portal.
Solo is the free tier; **Team / Business / AI** are paid and each maps to a
Stripe price. Nothing charges customers until the steps below are done.

## 1. Create the products & prices (Stripe Dashboard → Products)

Create one product per paid tier, each with a **recurring monthly** GBP price:

| Plan     | Suggested price | Notes                |
|----------|-----------------|----------------------|
| Team     | £79 / month     | per seat (quantity)  |
| Business | £149 / month    | per seat (quantity)  |
| AI       | £299 / month    | per seat (quantity)  |

Copy each resulting **Price ID** (`price_...`).

The 14-day free trial is applied automatically by `create-checkout-session`
(`subscription_data[trial_period_days]=14`) — you do **not** set it on the price.

## 2. Set Supabase Edge Function secrets

In Supabase → Project Settings → Edge Functions → Secrets (or
`supabase secrets set`):

```
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_PRICE_ID_TEAM=price_...
STRIPE_PRICE_ID_BUSINESS=price_...
STRIPE_PRICE_ID_AI=price_...
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_...     # from step 3
APP_URL=https://your-app-domain            # used for Checkout return URLs
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## 3. Create the subscription webhook (Stripe Dashboard → Developers → Webhooks)

- Endpoint URL:
  `https://<project-ref>.functions.supabase.co/stripe-subscription-webhook`
- Events to send:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy the signing secret (`whsec_...`) into `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`.

The webhook resolves the owning company from `subscription.metadata.company_id`
(stamped at checkout), falling back to the Stripe customer id — so each
company's plan is updated independently.

## 4. Functions involved (already deployed)

| Function                      | Auth (verify_jwt) | Purpose                                  |
|-------------------------------|-------------------|------------------------------------------|
| `create-checkout-session`     | yes               | Start a subscription (trial) for a company |
| `stripe-customer-portal`      | yes               | Manage / cancel / update card            |
| `stripe-subscription-webhook` | no (signed)       | Sync Stripe subscription → company plan  |

## 5. Test (Stripe test mode)

1. Use test keys/prices and card `4242 4242 4242 4242`.
2. In-app: **Settings → Plan & Billing → Start 14-day trial** on a paid tier.
3. Complete Checkout → you return to `/settings/plan?checkout=success`.
4. The webhook sets `company_settings.plan` and
   `stripe_subscription_status = trialing`; entitlements unlock.
5. **Manage billing** opens the Stripe portal; cancelling reverts the company
   to the free **Solo** plan on the next webhook.

## Note on the pricing model

Solo is currently the **free** baseline (it has no Stripe price). If you want
Solo to be a paid £29 tier instead, create a Solo product/price, add
`STRIPE_PRICE_ID_SOLO`, set `paid: true` + `price: 29` on the solo plan in
`src/config/modules.js`, and add `solo` to `PRICE_ENV` in
`create-checkout-session`.
