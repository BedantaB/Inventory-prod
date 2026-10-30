# Deploying to production (Supabase + Vercel)

This guide puts the app online for real use. It takes about an hour the first time.

You will end up with:

- **A production Supabase project** in Mumbai for the database, logins and photos. It is
  separate from the development project you have been testing with.
- **A Vercel project** in Mumbai that runs the app at a web address like
  `https://your-shop.vercel.app`.
- **One platform admin login** (you). It creates each shop and its owner's login. Each owner then
  adds their own staff inside the app. Shops never see each other's data, and the platform admin
  sees no shop's items, customers or orders.

> **Never put the sample data on production.** `pnpm db:seed` refuses to run there. For
> production you create only the platform admin login (step 5).

> **Already running version 1?** Don't follow steps 1–7 again: see
> [Upgrading from version 1 to version 2](#upgrading-from-version-1-single-shop-to-version-2-multi-shop).

---

## Before you start

- The code is working locally: `pnpm check` passes.
- You have a **Supabase** account ([supabase.com](https://supabase.com)) and a **Vercel**
  account ([vercel.com](https://vercel.com)). You can sign up for Vercel with GitHub or email.
- Optional: a **GitHub** account. It makes later updates one click (step 6, option A).
- Turn on **two-factor login** for your Supabase, Vercel and GitHub accounts. Whoever gets into
  those accounts gets your business data.

---

## Step 1: Create the production Supabase project

1. Supabase dashboard → **New project**.
2. Name it, for example `inventory-prod`.
3. **Region:** South Asia (Mumbai) — `ap-south-1`.
4. **Database password:** let Supabase generate a strong one, and save it in a password manager.
   Letters and numbers only is easiest (see README, "Troubleshooting").
5. **Plan:**
   - On the **Free plan**, projects are **paused after 7 days without use** and have **no
     automatic backups**.
   - For real business data, use the **Pro plan**: daily backups, and it never pauses. You can
     start on Free and upgrade later; nothing changes in the app.

## Step 2: Set up logins (Supabase Auth)

In the production project:

1. **Authentication → Sign In / Providers → Email**
   - Keep **Email** enabled.
   - Turn **off** "Allow new users to sign up".
   - Turn **off** "Confirm email".
2. **Authentication → URL Configuration**
   - Fill this in **after step 6**, once you know the web address:
     - **Site URL**: `https://your-shop.vercel.app` (or your own domain)
     - **Redirect URLs**: add `https://your-shop.vercel.app/**`
3. **Emails for "Forgot password"** (only the owner uses this; staff passwords are reset by the
   owner in the app):
   - Supabase's built-in email sender allows only a few emails per hour and is meant for
     testing.
   - For production, add your own sender under **Authentication → Emails → SMTP Settings**,
     using any email provider that offers SMTP (Brevo, Resend, Amazon SES, Zoho Mail…). Use an
     address like `no-reply@your-domain`.

## Step 3: Collect the production keys

Create a file **`.env.production.local`** in the project folder. It is gitignored, like
`.env.local`. Fill it in the same way as `.env.local` (README step 4), but with the
**production** project's values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres.<prod-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
MIGRATION_DATABASE_URL=postgresql://postgres.<prod-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SITE_URL=https://your-shop.vercel.app
STAFF_EMAIL_DOMAIN=staff.inventory.app

# Only for step 5 (creating the platform admin login). Remove them afterwards.
PLATFORM_ADMIN_EMAIL=you@example.com
PLATFORM_ADMIN_PASSWORD=a-long-password-you-will-remember
PLATFORM_ADMIN_NAME=Your Name
```

Each shop's name, address and phone (printed on orders) are set in the app, under **Shop
settings**.

## Step 4: Create the tables in production

```bash
ENV_FILE=.env.production.local pnpm db:migrate
```

This creates every table, the stock and order rules, the security policies and the photo storage
bucket. (Each shop gets the built-in units when it is created.) You should see `migrations applied successfully`. Ignore notices
like "already exists, skipping".

## Step 5: Create the platform admin login

```bash
ENV_FILE=.env.production.local pnpm platform-admin:create
```

It prints the email and username. Then delete the three `PLATFORM_ADMIN_…` lines from
`.env.production.local`.

## Step 6: Put the app on Vercel

Choose one of the two options below.

### Option A: from GitHub (recommended: every later update deploys itself)

1. Create a **private** repository on GitHub and push the code:
   ```bash
   git remote add origin git@github.com:<you>/inventory.git
   git push -u origin main
   ```
2. In Vercel: **Add New… → Project → Import** your repository.
   - Framework: **Next.js** (detected automatically). Leave the build settings as they are.

### Option B: from your computer (no GitHub)

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link      # creates the Vercel project
```

### Then, for either option

1. **Environment variables:** go to Vercel → Project → **Settings → Environment Variables**.
   Add every line of `.env.production.local` for the **Production** environment. Mark
   `SUPABASE_SECRET_KEY` and both database URLs as **Sensitive**.
   (`MIGRATION_DATABASE_URL` is not needed by the running app; you can leave it out.)
2. **Region:** `vercel.json` already sets **bom1 (Mumbai)**, next to the database. Check it under
   **Settings → Functions → Function Region**.
3. **Node.js version:** **Settings → General → Node.js Version → 22.x** or newer.
4. **Deploy:**
   - Option A: Vercel deploys after the import. Use **Redeploy** after adding the variables.
   - Option B: run `pnpm dlx vercel@latest --prod`.
5. **Point Supabase at the web address:**
   - Note the address, e.g. `https://your-shop.vercel.app`.
   - Fill in Supabase **Site URL** and **Redirect URLs** (step 2.2).
   - Make sure `NEXT_PUBLIC_SITE_URL` in Vercel is the same address.
   - Redeploy if you changed it.
6. **Optional: your own domain.** Add it under Vercel → **Settings → Domains**. Then update the
   Supabase URLs and `NEXT_PUBLIC_SITE_URL` to match.

## Step 7: First day checks

1. Log in as the platform admin. You land on **Shops**. Use **Add shop** to create the shop and
   its owner's login (a username and password). Tell the owner both.
2. Open the web address on the owner's phone and log in as the owner. Under **Shop settings**,
   check the name, address and phone.
3. **Staff & Logins:** add a login for each staff member.
4. Check the **Units** page (Items → Units at the bottom) and add any you need.
5. Add your items:
   - **Import from spreadsheet** on the Items page is fastest: fill **Opening stock** and
     **Cost price** so stock starts correct.
   - Or add items one by one, then use **Add Stock**.
6. Add your customers.
7. Make one real test order, print it, and check the stock went down.
8. On staff phones, open the address in Chrome and use **⋮ → Add to Home screen**, so the app
   opens like any other app.

---

## Updating the app later

1. On your computer: make the change, then run `pnpm check` (and `pnpm e2e` against your dev
   project).
2. If the change includes a new migration (`src/db/migrations/`), apply it to production
   **before** deploying the new code:
   ```bash
   ENV_FILE=.env.production.local pnpm db:migrate
   ```
   Migrations only add things, so the current version keeps working in the meantime.
3. Deploy:
   - Option A: `git push`.
   - Option B: `pnpm dlx vercel@latest --prod`.
4. If an update goes wrong:
   - In Vercel, **Deployments → (previous one) → Promote to Production** puts the previous
     version back in seconds.
   - Database changes are not undone by this, which is why migrations only ever add.

## Upgrading from version 1 (single shop) to version 2 (multi-shop)

Version 2 moves everything that is already in the database into one shop called **My Shop**.
Its owner, staff, items, stock, customers and orders stay exactly as they were. The upgrade test
(`tests/db/upgrade-v1.test.ts`) checks this on a copy of a version 1 database.

Unlike normal updates, **this migration and the new code must go live together**. After the
migration, version 1 can no longer save anything, and version 2 doesn't work on the old
database. Expect the app to be unusable for a minute or two, so do it when nobody is working
(early morning or after closing).

1. **Take a backup first** (see [Backups](#backups)). On the Free plan this is your only copy.
2. Make sure `pnpm check` passes and the `v2-multishop` branch is ready to merge.
3. Apply the migration to production:
   ```bash
   ENV_FILE=.env.production.local pnpm db:migrate
   ```
4. **Straight away**, deploy the new code: merge `v2-multishop` into `main` and `git push`.
   Wait for Vercel to show the deployment as **Ready**.
5. Create your platform admin login (step 5 above). Use a **different email** from the shop
   owner's: one email can only have one login.
6. Log in as the shop owner and open **Shop settings**: rename "My Shop" and fill in the
   address and phone (they replace the old `BUSINESS_*` settings, which you can delete from
   Vercel).
7. Log in as the platform admin: you should see the one shop. Add new shops from there.

If something goes wrong, restore the backup from step 1 and promote the previous Vercel
deployment (see "Updating the app later", step 4).

## Backups

- **Pro plan:** Supabase keeps daily backups for 7 days. You can restore them from
  **Database → Backups**.
- **Your own copy** (any plan, recommended weekly, keep it somewhere safe):
  ```bash
  pg_dump "<MIGRATION_DATABASE_URL from .env.production.local>" --format=custom --file=inventory-$(date +%F).dump
  ```
  This needs `pg_dump` 15 or newer: `sudo apt install postgresql-client`, or use the Supabase
  CLI's `supabase db dump`. Item photos are in Supabase Storage, which is not included in
  `pg_dump`.

## Security checklist

- [ ] `SUPABASE_SECRET_KEY` and the database password exist only in `.env.production.local`
      and Vercel (Sensitive), never in git, chats or screenshots.
- [ ] Public sign-up is **off** (step 2.1).
- [ ] Every account (Supabase, Vercel, GitHub, the email used for the owner login) has
      two-factor login.
- [ ] Turn off the logins of staff who leave, the same day (Staff & Logins → Turn off login).
- [ ] When a shop stops using the app, turn the whole shop off (platform admin → Shops →
      the shop → Turn off shop). Nothing is deleted.
- [ ] If the secret key or database password ever leaks:
  - Create a new key under Project Settings → API Keys and delete the old one.
  - Reset the database password under Project Settings → Database.
  - Update the values in Vercel and redeploy.

## Troubleshooting

| Problem                                         | Fix                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Login page loads but logging in fails on Vercel | Check the Supabase URL and keys in Vercel's variables, then redeploy.                                 |
| "Forgot password" email never arrives           | Set up SMTP (step 2.3) and check the Redirect URLs (step 2.2).                                        |
| Pages are slow on Vercel                        | Check the function region is **bom1** and the Supabase project is in **Mumbai**.                      |
| `Tenant or user not found`                      | `DATABASE_URL` has the wrong project ref or region. Copy it again from Supabase → **Connect**.        |
| Site is down / "project paused"                 | Free-plan projects pause after 7 days unused. Restore it in the Supabase dashboard, and consider Pro. |
