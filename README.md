# Inventory

Stock, customers and orders for a wholesale business. Works on phones in the godown and on the
counter desktop.

Built with Next.js, Supabase (Postgres + Auth), Drizzle ORM, Tailwind and shadcn/ui.

- Project rules and commands: [CLAUDE.md](CLAUDE.md)
- Design and phases: [docs/PLAN.md](docs/PLAN.md)
- Future ideas: [ROADMAP.md](ROADMAP.md)

---

## Local setup

You do **not** need Docker. Development uses a free Supabase project in the cloud. Keep it
separate from the one you will use for real business data.

### 1. Install the tools

- **Node.js 22 or newer**: check with `node -v`.
- **pnpm**: run `npm install -g pnpm`, then check with `pnpm -v`.
- **Git**

### 2. Create a Supabase project for development

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Set **Region** to **South Asia (Mumbai) — ap-south-1**.
3. Choose a strong **database password** and save it somewhere safe (a password manager).

### 3. Configure Supabase Auth

In the Supabase dashboard for your project:

1. **Authentication → Sign In / Providers**
   - Keep **Email** enabled.
   - Turn **off** "Allow new users to sign up". Only the admin creates logins, from inside the app.
   - Turn **off** "Confirm email". Staff logins are created already confirmed.
2. **Authentication → URL Configuration**
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: add `http://localhost:3000/**`. This is needed for "Forgot password" emails.

### 4. Get your keys and fill in `.env.local`

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in each value:

| Variable                                   | Where to find it                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                 | **Project Settings → Data API** → Project URL (`https://<ref>.supabase.co`)                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`     | **Project Settings → API Keys** → Publishable key (`sb_publishable_…`)                                      |
| `SUPABASE_SECRET_KEY`                      | **Project Settings → API Keys** → Secret keys → create or reveal one (`sb_secret_…`). **Never share this.** |
| `DATABASE_URL`                             | Click **Connect** (top bar) → Connection string → **Transaction pooler** (port **6543**)                    |
| `MIGRATION_DATABASE_URL`                   | Same screen → **Session pooler** (port **5432**)                                                            |
| `NEXT_PUBLIC_SITE_URL`                     | `http://localhost:3000` for local development                                                               |
| `STAFF_EMAIL_DOMAIN`                       | Leave as is. Staff log in with a username; this is only used behind the scenes.                             |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Your own email and a password for the first admin (owner) login.                                            |
| `SEED_STAFF_PASSWORD`                      | Password for the two sample staff logins (`ramesh`, `sunita`).                                              |

In both database URLs, replace `[YOUR-PASSWORD]` with your database password. If the password
contains special characters (`@ : / ? # & %`), they must be URL-encoded. For example, `@`
becomes `%40`. The simplest fix is a password made of only letters and numbers; you can reset
it under **Project Settings → Database**.

`.env.local` is gitignored. Never commit it or paste its contents anywhere.

### 5. Install, create the tables, add sample data

```bash
pnpm install
pnpm db:migrate     # creates all tables, rules and security policies
pnpm db:seed        # creates the logins and sample items, customers and stock
pnpm dev            # starts the app at http://localhost:3000
```

The seed script creates three logins:

| Login                                         | Password              | Role  |
| --------------------------------------------- | --------------------- | ----- |
| your `SEED_ADMIN_EMAIL` (or username `owner`) | `SEED_ADMIN_PASSWORD` | Admin |
| username `ramesh`                             | `SEED_STAFF_PASSWORD` | Staff |
| username `sunita`                             | `SEED_STAFF_PASSWORD` | Staff |

Run `pnpm db:seed --reset` at any time to wipe the items, customers, stock and orders and
reload the sample data. Logins are kept.

### 6. Check everything works

```bash
pnpm check          # typecheck + lint + tests (tests need no database)
```

To try the app from your phone on the same Wi-Fi, run `pnpm dev --hostname 0.0.0.0` and
open `http://<your-computer's-IP>:3000` on the phone.

---

## Troubleshooting

| Problem                                        | Fix                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `password authentication failed`               | Wrong database password, or it has special characters that aren't URL-encoded.                |
| `Tenant or user not found`                     | The pooler URL has the wrong project ref or region. Copy it again from **Connect**.           |
| `Missing or invalid values in .env.local: …`   | The listed variables are empty or malformed in `.env.local`.                                  |
| `email_exists` or login problems after seeding | Run `pnpm db:seed` again. It resets the seed logins' passwords to the values in `.env.local`. |

## Deployment

Covered in `DEPLOYMENT.md` (added in Phase 5).
