# 🏨 Pocket Reception

Simple hotel management app for small hotels. Built for phone-first use.

**Stack:** Node.js + Express + Supabase + Railway

---

## Features

- **Quick reservations** — add guest name + dates in under 10 seconds
- **Room board** — see all rooms color-coded (free / occupied / dirty)
- **Cleaner mode** — separate simple view with one-tap "Mark clean" buttons
- **PIN auth** — admin PIN and cleaner PIN, no accounts needed
- **PWA** — installable on phone home screen, works like a native app

---

## Setup (30 minutes)

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `schema.sql`
3. Edit the seed data in `schema.sql` to match your actual room numbers
4. Copy your **Project URL** and **service_role key** from Settings → API

### 2. Local development

```bash
git clone <your-repo>
cd pocket-reception
npm install

# Copy env template
cp .env.example .env

# Edit .env with your values:
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_SERVICE_KEY=eyJ...
# ADMIN_PIN=1234        ← change this!
# CLEANER_PIN=0000      ← change this!
# SESSION_SECRET=some-random-string

npm run dev
# → http://localhost:3000
```

### 3. Deploy to Railway

1. Push to GitHub
2. New Railway project → "Deploy from GitHub repo"
3. Set these environment variables in Railway:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your service role key |
| `ADMIN_PIN` | Your chosen admin PIN (4+ digits) |
| `CLEANER_PIN` | Your chosen cleaner PIN (4+ digits) |
| `SESSION_SECRET` | Any random string (use a password generator) |
| `NODE_ENV` | `production` |

4. Deploy → done. Railway gives you a public URL.

### 4. Install on phone (PWA)

**iPhone:**
1. Open the app URL in Safari
2. Tap the Share button → "Add to Home Screen"
3. Tap Add → appears as an app

**Android:**
1. Open in Chrome
2. Tap menu → "Add to Home Screen" (or Chrome will prompt automatically)

---

## PIN system

- **Admin PIN** → full access (bookings, rooms, cleaner, settings)
- **Cleaner PIN** → cleaner mode only

Sessions last 30 days — staff won't need to re-enter the PIN constantly.

---

## Room status flow

```
PENDING reservation
    ↓ assign room
CONFIRMED
    ↓ check in
CHECKED IN → room = occupied
    ↓ check out
CHECKED OUT → room = dirty
                   ↓ cleaner marks done
               room = free
```

---

## Adding / removing rooms

Go to **Settings** in the app → Add room form.

Or run SQL directly in Supabase:
```sql
INSERT INTO rooms (number, floor) VALUES ('305', 3);
DELETE FROM rooms WHERE number = '104';
```

---

## File structure

```
pocket-reception/
├── server.js              ← Express entry point
├── schema.sql             ← Run this in Supabase
├── nixpacks.toml          ← Railway build config
├── lib/
│   └── supabase.js        ← Supabase client
├── middleware/
│   └── auth.js            ← PIN session checks
├── routes/
│   ├── layout.js          ← Shared HTML shell
│   ├── auth.js            ← Login/logout
│   ├── reservations.js    ← Bookings CRUD
│   ├── rooms.js           ← Room board
│   ├── cleaner.js         ← Cleaner mode
│   └── settings.js        ← Settings + room management
└── public/
    ├── css/app.css        ← All styles
    ├── sw.js              ← Service worker (PWA)
    └── manifest.json      ← PWA manifest
```

---

## Future additions (when ready)

- SMS/WhatsApp notifications for check-in reminders
- Guest notes / special requests field
- Weekly availability view
- Export reservations to CSV
- Multiple hotels (multi-tenant)
