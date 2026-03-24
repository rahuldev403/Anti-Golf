# Vercel Deployment Guide

## 1) Import Project

1. In Vercel, choose `Add New -> Project`.
2. Import this repository.
3. Framework preset should be detected as `Next.js`.

## 2) Build Settings

Use defaults:

- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

## 3) Environment Variables

Copy values from your local `.env.local` into Vercel Project Settings -> Environment Variables.

Minimum required:

- `NEXT_PUBLIC_SITE_URL` (set to your Vercel domain, e.g. `https://your-app.vercel.app`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MONTHLY` (or `STRIPE_PRICE_ID`)
- `STRIPE_PRICE_ID_YEARLY`

Use `.env.example` as a template.

## 4) Stripe Webhook

After first deployment:

1. Create a Stripe webhook endpoint pointing to:
   - `https://your-app.vercel.app/api/webhooks/stripe`
2. Subscribe to the events your app expects.
3. Put the generated webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## 5) Redeploy

After setting env vars, redeploy from Vercel.

## 6) Post-Deploy Smoke Test

1. Open `/` and verify auth modal works.
2. Sign in and open `/dashboard`.
3. Open `/dashboard/billing` and verify plan flow.
4. Trigger checkout and verify redirect URLs work.

## Notes

- Local production build currently passes (`npm run build`).
- Next.js shows a non-blocking warning that `middleware.ts` convention is deprecated in favor of `proxy.ts`. This does not block deployment, but can be migrated in a follow-up cleanup.
