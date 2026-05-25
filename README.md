# MekLoc

MekLoc is a React + Vite SaaS frontend for Moroccan car rental agencies. It runs with mock data by default and switches to Supabase when environment variables are present.

## Install and Run

```bash
npm install
npm run dev -- --port 5173
```

If your local npm cache has permission issues:

```bash
npm install --cache .npm-cache
npm run dev -- --port 5173
```

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Paste and run `supabase/schema.sql`.
4. In Authentication settings, disable email confirmation for local testing, or confirm users before first login.
5. Copy `.env.example` to `.env.local`.
6. Fill in:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

7. Restart the Vite dev server.

## Auth Flow (New)

- Public registration is disabled.
- Login uses email/password or Google for existing approved users.
- Public prospects use `/demande-acces` to request onboarding.
- Access requests are stored in `access_requests` and reviewed in Super Admin.
- After admin approval/payment, account activation is handled by admin workflow.

### Access Request Email (Placeholder)

The app now supports real email sending through a webhook/Edge Function.
Add this environment variable:

```bash
VITE_ACCESS_REQUEST_EMAIL_WEBHOOK=https://your-edge-function-or-webhook-url
```

Expected POST payload:
- `to`
- `subject`
- `text`
- `html`

You can connect this to:
- Supabase Edge Function + Resend
- Make/Zapier webhook
- Your backend mail service

Suggested subject:
`Votre demande d’accès MekLoc a été reçue`

### Supabase Edge Function + Resend (Production)

1. Install and login Supabase CLI.
2. Deploy function:

```bash
supabase functions deploy send-access-request-email
```

3. Set function secrets:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set RESEND_FROM_EMAIL="MekLoc <contact@mekloc.com>"
supabase secrets set PUBLIC_SITE_URL=https://mekloc.com
supabase secrets set APP_URL=https://mekloc.com
```

4. In `.env.local`, point frontend webhook to the function URL:

```bash
VITE_ACCESS_REQUEST_EMAIL_WEBHOOK=https://<project-ref>.functions.supabase.co/send-access-request-email
```

5. Restart the app and test `/demande-acces`.
- Google login uses Supabase Auth OAuth provider.
- Google users without an agency profile are redirected to `/onboarding`.
- Onboarding creates the agency and `users_profiles` row with `account_status = pending`.
- Dashboard routes are protected only when Supabase env variables exist.
- If Supabase env variables are missing, MekLoc keeps using mock data.

## Approval and Subscription Gates

Dashboard access is allowed only when:

```text
account_status = active
and billing_status in (paid, trial)
```

Status behavior:

- `pending`: shows “Votre compte est en attente d’approbation par MekLoc.”
- `rejected`: shows “Votre demande a été refusée.”
- `suspended`: shows “Votre compte est suspendu. Contactez MekLoc.”
- `unpaid`, `overdue`, or `cancelled`: shows the payment required page.

If a subscription expires in less than 7 days, the dashboard shows a renewal warning badge.

## Super Admin

The hidden route is:

```text
/super-admin
```

Only profiles with `is_super_admin = true` can access it when Supabase is configured.

To make a user a super admin, first register/sign in once, then run this in Supabase SQL editor:

```sql
update public.users_profiles
set is_super_admin = true,
    account_status = 'active'
where email = 'admin@example.com';
```

The Super Admin panel can:

- Approve, reject, suspend, and reactivate agencies
- Change subscription plans
- Mark subscriptions paid or unpaid
- Extend subscriptions
- Add payment notes
- Filter agencies by approval and billing state

## Google Login Setup

1. In Supabase, open Authentication > Providers.
2. Enable Google.
3. Add your Google OAuth Client ID and Client Secret.
4. In Supabase Authentication > URL Configuration, set:

```text
Site URL: http://localhost:5173
Redirect URLs:
http://localhost:5173/dashboard
```

5. In Google Cloud Console, add the Supabase callback URL shown in the Google provider panel. It usually looks like:

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

## Multi-Agency Data Model

Every operational table has `agency_id`:

- `vehicles`
- `clients`
- `reservations`
- `contracts`
- `payments`
- `maintenance`

The `users_profiles` table links each auth user to one agency. RLS policies use `public.current_agency_id()` so users can only read and mutate rows for their own agency.

## Storage

The schema creates two private buckets:

- `logos`
- `contract-pdfs`

Files are stored under an agency folder:

```text
logos/{agency_id}/...
contract-pdfs/{agency_id}/...
```

Storage RLS checks the first path segment against the signed-in user's agency.

## Build

```bash
npm run build
```

## Maintenance Table Notes

The maintenance module now uses real CRUD fields:

- `service_type`, `last_service_date`, `next_service_date`
- `current_mileage`, `mileage_at_service`, `next_service_mileage`
- `provider_name`, `status`, `notes`, `invoice_url`

If your project was created earlier, re-run `supabase/schema.sql` to add missing columns safely with `add column if not exists`.

## Vercel Deployment

1. Push this project to GitHub.
2. Import the repo in Vercel.
3. Add environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

`vercel.json` already includes SPA rewrites so direct route refresh works (`/dashboard`, `/maintenance`, `/super-admin`, etc.).
