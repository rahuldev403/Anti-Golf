# Anti Golf



A modern golf challenge platform where players log scores, compete in draws, and support charities through subscriptions.

![Anti Golf App Screenshot](public/logo.png)

## Why This App Exists

Anti Golf combines three things in one experience:

- Competitive score tracking
- Subscription-powered prize draws
- Charity impact built into the user journey

Users can sign up, track their game, subscribe through Stripe, and follow draw/winner updates from a dedicated dashboard.

## Core Features

- Email/password authentication with Supabase
- Role-aware dashboard flow (user/admin)
- Stripe subscription checkout (monthly/yearly)
- Stripe webhook handling for subscription events
- Score submission and dashboard tracking
- Charity-focused user experience and content
- Admin area for draw and user management tasks

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Auth + Database)
- Stripe (Checkout + Webhooks)
- Framer Motion + Lucide icons

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` values into your local `.env.local` and set real credentials:

```env
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID_MONTHLY=price_monthly_id
STRIPE_PRICE_ID=price_default_monthly_id
STRIPE_PRICE_ID_YEARLY=price_yearly_id
```

### 3. Run the app

```bash
npm run dev
```

Open http://localhost:3000

## Helpful Scripts

- `npm run dev` - start local dev server
- `npm run build` - build production bundle
- `npm run start` - run production build locally
- `npm run lint` - lint project
- `npm run create:admin` - create an admin user with script input/env vars

## Stripe Setup Notes

Use these endpoints in Stripe Dashboard:

- Checkout success/cancel URLs are based on `NEXT_PUBLIC_SITE_URL`
- Webhook endpoint:

```text
https://your-app.vercel.app/api/webhooks/stripe
```

Make sure `STRIPE_WEBHOOK_SECRET` is set after creating the webhook endpoint.

## Deployment

Recommended target: Vercel.

1. Import the project
2. Add all environment variables
3. Deploy
4. Configure Stripe webhook endpoint with deployed URL

See `VERCEL_DEPLOYMENT.md` for detailed deployment guidance.

## Project Structure (High Level)

```text
app/
  api/                  # server routes (checkout, webhooks, admin actions)
  admin/                # admin pages and components
  dashboard/            # user dashboard pages
  auth/callback/        # auth callback route
public/
  image.png             # screenshot used in README
utils/supabase/         # Supabase client helpers
scripts/
  create-admin.mjs      # admin bootstrap script
```

## License

Private project.
