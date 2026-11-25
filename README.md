# B2 Sync

A study platform for you and your friends: shared courses and syllabus tracking, a study timer,
a distraction-free **Focus Mode** (soft music + shuffled study quotes), XP/levels/streaks, and a
**pledge system** — promise study time to your group, and if you miss it you get a warning and a
dare (or take the shame). Too many warnings and you're removed from the group.

Built with Next.js, TypeScript, Tailwind, Supabase (database + login + file storage), Recharts,
Framer Motion. Designed for about 50 people and **zero monthly cost** on free tiers.

---

## What's in the app

| Page | What it does |
|---|---|
| Dashboard | Greeting, stats, weekly chart, today's schedule, deadlines, group activity, daily challenge |
| Courses | Courses by semester, topics/subtopics, Not started / In progress / Completed, notes, deadlines, group progress |
| Study Timer | Pomodoro, stopwatch, countdown, custom, break timer, history, daily/weekly/monthly totals |
| Focus Mode | Full-screen timer, soft music that plays only while the timer runs, shuffled study quotes, distraction counter |
| Learning Vault | Upload PDFs/images/audio/docs or save links; filter by course, group, type; private or shared |
| Study Groups | Create, invite code or link, members, shared courses, group progress, kick/leave |
| Pledges & Dares | Make a pledge, warnings, dares, Wall of Shame, emoji reactions |
| Leaderboard | XP, this-week minutes, streaks per group |
| Goals & Missions | Goals with priority/deadline/progress, daily + weekly missions, 17 achievements |
| Habits | Daily check-in grid, streaks, 30-day consistency |
| Calendar | Month / week / day, classes, exams, assignments, group events, reminders |
| Analytics | Charts for study time, courses, topics, goals, habits, streaks, group performance |
| Profile / Settings / Search | Picture and details, dark/light mode, notifications, privacy, global search |

Login is by **email + password**, **email one-time code** (Resend), or **Google**. Passwords, verification and reset links are handled by Supabase Auth. Sessions are JWT-cookie based and expire after **7 days**, so everyone signs in again weekly. New users submit their details at first login; an admin approves the join request before they get full access.

---

## Setup, step by step

### 1. Install Node.js
Download the **LTS** version from https://nodejs.org and install it. Check it worked:
```
node -v
```
(it should print v20 or higher).

### 2. Install the project
Open a terminal **inside this folder** and run:
```
npm install
```

### 3. Create your Supabase project (free)
1. Sign up at https://supabase.com and click **New project**.
2. Pick the region closest to you (Singapore is closest to Bangladesh) and set a database password (save it).
3. Wait about 2 minutes until it finishes setting up.

### 4. Create the database
1. In Supabase open **SQL Editor → New query**.
2. Open the file `supabase/schema.sql` from this project, copy **everything**, paste it in, press **Run**.
3. It should say "Success". It is safe to run again later (it won't duplicate anything).

This creates all tables, the security rules (Row Level Security), the file storage buckets and the
penalty logic.

### 5. Turn on login
**Google (free):**
1. Go to https://console.cloud.google.com → create a project → **APIs & Services → Credentials → Create credentials → OAuth client ID** (type: *Web application*).
2. Under **Authorised redirect URIs** paste the callback URL shown in Supabase at **Authentication → Providers → Google**.
3. Copy the Client ID and Client Secret into that same Supabase page and switch Google **on**.
4. Supabase → **Authentication → Providers → Phone** → make sure it is switched **off**.

**Allowed URLs:** Supabase → **Authentication → URL Configuration**:
- Site URL: `http://localhost:3001` (change to your Vercel address later)
- Redirect URLs: add `http://localhost:3001/**` and later `https://YOUR-APP.vercel.app/**`

### 6. Add your keys
1. Copy the file `.env.local.example` and name the copy `.env.local`.
2. In Supabase open **Project Settings → API**. Copy the **Project URL** and the **anon / publishable key** into `.env.local`.

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
Never share the `service_role` key and never put it in a `NEXT_PUBLIC_` variable.

**No keys yet? Local mode works out of the box.** If `.env.local` is missing (or still has the
placeholder values), B2 Sync automatically runs in local mode: sign in with Google, and all data
is stored in your browser's localStorage. Every page works — groups, courses, timer, XP, habits,
missions, vault files. Add real Supabase keys later to sync across devices; nothing else changes.

### 6b. Redis cache and the exclusive owner admin
1. Run the whole `supabase/schema.sql` again in the SQL Editor. The final sections add the
   `role` and `suspended` columns, their RLS guards, admin security tables and the persistent
   sign-in history used to skip onboarding for returning emails.
2. In `.env.local` set:
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only; required for owner provisioning and every admin operation.
   - `OWNER_ADMIN_EMAIL=shahriarniaztonmoy@gmail.com` — identity only. An email by itself never grants admin.
   - `JWT_SECRET` — long random string (`openssl rand -hex 32`). Sessions last 7 days.
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — shared rate limits and session cache.
     Without them, an in-memory store is used for development.
   - `ADMIN_TOTP_SECRET` — optional 2FA (`openssl rand -base32 20`). Leave blank to disable 2FA.
3. Create/confirm the owner account: sign up and verify
   `shahriarniaztonmoy@gmail.com` (or sign in with Google using that email). The script needs a
   real Supabase Auth user with a confirmed email.
4. Provision from the server (never from the browser):
   ```
   npm run provision:admin
   ```
   It looks up the user by email, verifies `email_confirmed_at` and the immutable Auth user ID,
   writes `profiles.role = 'admin'`, records that ID in `schema_meta`, and sets
   `app_metadata.role = 'admin'`. It refuses to replace an already provisioned owner or to create
   a second admin.
5. Restart the app. The provisioned owner can sign in with Google at `/login` and goes straight to
   `/admin/dashboard`, or use the dedicated `/admin/login` (password + optional 2FA). Ordinary users
   are redirected back to `/dashboard?denied=1`; admin APIs return `403`.

### 7. Run it
```
npm run dev
```
Open http://localhost:3001. Sign in, choose a username, create a group, share the invite code.

---

## Deploy for free on Vercel
1. Put the project on GitHub (without `.env.local`; it's already in `.gitignore`).
2. At https://vercel.com choose **Add New → Project**, import the repo.
3. Under **Environment Variables** add the same variables from `.env.local`.
4. Click **Deploy**.
5. Copy your new address (like `https://b2sync-xyz.vercel.app`) and add it to Supabase **URL Configuration** (Site URL + Redirect URLs, step 5) and, if Google complains, to your Google OAuth client.

---

## How the penalty system works
1. In **Pledges & Dares** you promise, for example, "90 minutes of study before tomorrow 8 pm".
2. Your timer sessions count automatically.
3. When the deadline passes: **kept** = +40 XP. **Missed** = +1 warning and a random dare.
4. You choose: **do the dare** (write what you did: warning removed, +15 XP) or **take the shame** (−30 XP, you appear on the Wall of Shame, warning stays).
5. At the group's warning limit (default 3) you're removed. If you rejoin with the invite code you come back with one warning left.
6. A pledge can only be withdrawn in the first 10 minutes, so nobody can dodge by deleting it.

Pledges are settled whenever anyone opens the app. For a guaranteed daily check, turn on the free
`pg_cron` extension (Supabase → Database → Extensions) and run the two commented lines at the bottom of
`supabase/schema.sql`. (Alternative: call `/api/cron` daily with `Authorization: Bearer <CRON_SECRET>`; needs
`SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.)

### Honest limits (good to know)
- **It runs on trust.** Study time comes from the browser timer, so a technical friend could fake a session. That's fine for a group of friends who hold each other accountable; it's not exam-proof.
- Someone can **leave the group** to escape their warnings. If that becomes a problem, make the owner remove them and talk to them 🙂.
- Event reminders pop up **while B2 Sync is open**; there are no background push notifications.
- The free Supabase plan can pause a project after a long period of no activity. Check Supabase's current free-plan rules and just click "restore" if it ever happens.

---

## Costs
Supabase free + Vercel free + Resend free tier = **৳0/month** for ~50 users. No SMS or phone charges.

## Project layout
```
src/app/(app)/...      all signed-in pages (dashboard, timer, focus, arena, ...)
src/app/api/cron       optional daily penalty check
src/lib/quotes.ts      study quotes shown (and shuffled) in Focus Mode
src/components/ui      buttons, cards, modals, charts-ready building blocks
src/lib/ambient.ts     soft music generated in the browser (no files, no copyright)
supabase/schema.sql    the whole database, security rules and penalty logic
```

## Troubleshooting
- **Login page shows a setup banner:** `.env.local` is missing or wrong. Restart `npm run dev` after editing it.
- **"redirect_uri_mismatch" from Google:** the redirect URI in Google must be exactly the callback URL Supabase shows.
- **Signed in but stuck on a loading screen:** the SQL in step 4 hasn't been run.
- **"permission denied for table ..." / error 42501:** re-run `supabase/schema.sql`. New Supabase projects no longer grant Data API access automatically; the final grants section fixes this.

---

## Authentication setup (password, Google, verification, reset)

B2 Sync uses **Supabase Auth** for credentials, password hashing, verification emails, reset links and Google OAuth. This app never stores a plaintext password and never ships a secret to the browser. It adds a server-signed, httpOnly JWT cookie (`b2_session`) on top of Supabase so every protected route is checked consistently. Sessions expire after **7 days**.

### 1. Supabase dashboard configuration

1. **Authentication → Providers → Email**: switch **on**. Keep **Confirm email** **on** — this sends the verification link after registration and blocks unverified password logins.
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3001` (later your Vercel URL).
   - Redirect URLs: add `http://localhost:3001/auth/callback` and `http://localhost:3001/**`. Add both for your production domain too.
3. **Authentication → Providers → Google**: switch **on**. In Google Cloud Console create an OAuth *Web application* client, add the callback URL Supabase shows to **Authorized redirect URIs**, then paste the Client ID and Client Secret into Supabase.

4. **Authentication → Settings → SMTP**: to send verification/reset email from your domain, use Resend's SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key, sender = a verified domain address such as `B2 Sync <auth@yourdomain.com>`. If you skip SMTP, Supabase's default sender works but is rate-limited.
5. **Project Settings → API**: copy the URL and anon key into the `NEXT_PUBLIC_*` variables. Copy the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY` only (server-side). Run `supabase/schema.sql` again to add the admin/security tables and profile role columns.
6. Set `JWT_SECRET` (long random string), `OWNER_ADMIN_EMAIL`, optionally `ADMIN_TOTP_SECRET`, and Upstash credentials for shared rate limits. Restart `npm run dev` after changing env variables.

### 2. What each auth page does

| Page | Flow |
|---|---|
| `/signup` | Full name, email, strong password, confirm, terms, or Google. Supabase hashes the password and sends the verification link. Duplicate emails get a clear message. |
| `/verify-email` | Shows the address and resends the confirmation email (rate-limited) if needed. |
| `/login` | Email + password (show/hide, remember me, forgot link) and Google. The email-code tab has been removed. |
| `/forgot-password` | Sends a Supabase recovery link without revealing whether the email exists. |
| `/reset-password` | Reached through `/auth/callback`; sets a new password after Supabase validates the recovery session. |
| `/auth/callback` | Exchanges Google/confirmation/recovery codes, issues the JWT cookie, then redirects. OAuth errors return to `/login`. |

First-time users go to `/onboarding` once to choose a username and submit a join request. Returning emails are detected from a persistent sign-in history (plus the profile row) and go straight to `/dashboard`. The profile is created from the Supabase user ID, so returning Google/password users never create duplicate accounts.

The provisioned owner can enter the admin panel directly with Google at `/login`, or use the dedicated `/admin/login` → `/admin/dashboard` flow (password + optional 2FA). The panel has overview statistics, user management, content management (courses, materials, announcements), website settings, security logs/session revocation, join requests and an audit trail. All checks are server-side; the sidebar link is only a convenience. Google admin access still requires the provisioned immutable Auth ID, `profiles.role = 'admin'` and a confirmed owner email.

### 3. Security behaviour

- Password strength: 10+ characters with upper, lower, number and symbol. Checked in the browser and again on the server; Supabase does the real hashing.
- Login rate limits: 8 attempts / 15 min per email and 40 / 15 min per IP (Upstash Redis in production, in-memory fallback locally). Signup, resend and reset are rate-limited too.
- `remember=true` stores the JWT in a persistent 7-day cookie; otherwise it is a browser-session cookie. The JWT itself always expires after 7 days.
- Logout revokes the server session cache, signs out Supabase and clears the httpOnly JWT.
- **7-day expiry only ends the session.** It never deletes a user, profile, group, course or any other data.
- Admin role is stored in `profiles.role` and verified against the provisioned immutable Auth ID on every admin request. Registration defaults to `user`; role/owner fields are not writable through the API or RLS. The owner cannot be demoted, suspended or deleted through user management.
- All auth API routes are server-only. No keys, password hashes or reset tokens are exposed to frontend code.

### 4. Local mode (no keys yet)

If Supabase keys are absent, the app still works on one device. Password accounts use PBKDF2-SHA256 (150k iterations, random salt) in browser localStorage — no plaintext password — and a dev-only route issues the JWT cookie. No verification/reset email is sent; the reset token is shown on screen. This is a development fallback, not a multi-device production database. Add Supabase keys for real email verification, password reset and cross-device sync.
