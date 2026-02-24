# Pok Team Builder
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/CebanDan/pok-team-builder)

Responsive full-stack Pokemon team builder (desktop + mobile) with account auth, persistent teams, format rules, analytics, and Showdown import/export.

## Stack
- Frontend: Next.js (App Router) + React + Tailwind CSS
- Backend: Next.js Route Handlers (Node runtime)
- Auth: email/password (`bcryptjs`) + JWT HttpOnly cookie sessions
- Database: PostgreSQL + Prisma ORM
- Data source: PokeAPI (seed script for species/types/moves/items/abilities)
- Tests: Vitest (core analysis algorithms)

## MVP Features Implemented
- Account register/login/logout and session restore (`/api/auth/*`)
- Team overview with unlimited saved teams and `+ New Team` flow
- Team editor:
  - up to 6 Pokemon per team (configurable max size 1..6)
  - species, form, ability, item, level, nature, EVs, IVs, moves (4), gender
  - autosave + manual save
  - undo/redo
  - version history with restore
- Format selector with constraints:
  - `OU`, `UU`, `VGC`, `Custom`
  - banned species/moves/items checks and warnings
- Weakness & coverage analyzer:
  - type table (`weak/resist/immune/neutral`)
  - defensive hole detection
  - coverage indicator by team moves
- Move analyzer:
  - per move: super-effective/neutral/resisted/immune target type sets
  - highlights whether the team already covers that target type
- Counter suggestions:
  - by threatening type
  - by specific opponent species
  - uses type effectiveness, move availability, priority, and switch profile
- Showdown text import/export
- Seed scripts for canonical PokeAPI data

## Project Structure
```
src/
  app/
    api/...
    teams/[teamId]/page.tsx
  components/
    dashboard.tsx
    team-editor.tsx
    member-card.tsx
    team-analysis.tsx
  lib/
    analysis.ts
    auth.ts
    formats.ts
    showdown.ts
    validators.ts
prisma/
  schema.prisma
  seed.ts
```

## Database Schema
Core tables (Prisma models):
- `User` (email, passwordHash)
- `Team` (name, format, maxSize, JSON team data, owner)
- `TeamVersion` (snapshot history per team)
- `PokemonType` (damage relations JSON)
- `PokemonSpecies` (types/forms metadata)
- `PokemonMove` (type/power/priority metadata)
- `PokemonItem`
- `PokemonAbility`

See full schema: `prisma/schema.prisma`.

## Setup
### 1. Install dependencies
```bash
npm install
```

### 2. Start PostgreSQL
Option A: Prisma local DB server (no Docker required)
```bash
npm run db:start
npm run db:status
```
If you use this option, set `DATABASE_URL` to the `TCP` URL shown by `npm run db:status`.

Option B: Docker
```bash
docker compose up -d
```

Option C: Your own Postgres instance.

### 3. Configure env
```bash
cp .env.example .env
```
Update `.env` values as needed.

### 4. Generate Prisma client + initialize schema
```bash
npm run prisma:generate
npm run db:init
```
If you are using a full Postgres instance (not Prisma local DB), you can alternatively run:
```bash
npm run prisma:migrate -- --name init
```

### 5. Seed Pokemon data from PokeAPI
```bash
npm run db:seed
```

Default seed limits are moderate for local dev. You can increase via env vars:
- `SEED_SPECIES_LIMIT`
- `SEED_MOVES_LIMIT`
- `SEED_ITEMS_LIMIT`
- `SEED_ABILITIES_LIMIT`
- `SEED_CONCURRENCY`

Example (PowerShell):
```powershell
$env:SEED_SPECIES_LIMIT="1025"; $env:SEED_MOVES_LIMIT="900"; npm run db:seed
```

### 6. Run dev server
```bash
npm run dev
```
Open `http://localhost:3000`.

### 7. Run secure HTTPS dev (recommended)
To avoid the browser `Not secure` warning, run with a trusted local cert.

1. Install `mkcert` once on your machine.
2. Generate dev certs:
```bash
npm run cert:dev
```
3. In `.env`, set:
```env
COOKIE_SECURE=true
```
4. Start HTTPS dev server:
```bash
npm run dev:secure
```
Open `https://localhost:3000` (or your LAN IP if included in cert generation).

## Public Deploy

### Option A: Deploy on Vercel (Recommended for Next.js)

**Vercel is free, fast, and optimized for Next.js. Best for most users.**

#### Prerequisites
- GitHub account (free)
- Vercel account (free, sign up with GitHub)
- Hosted PostgreSQL database (Supabase, Neon, Railway, or any provider)

#### Step 1: Push to GitHub
If your project is not already on GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

#### Step 2: Set up a hosted PostgreSQL database

Choose one (all have free tiers):

**Option A1: Supabase (Easiest)**
1. Go to [https://supabase.com](https://supabase.com) → **Start your project**
2. Sign in with GitHub
3. Create a new project (region: close to you)
4. In **Project Settings** > **Database**, copy the **Connection String** (PSQL format)
5. Replace `[YOUR-PASSWORD]` with your password (set during project creation)

**Option A2: Neon**
1. Go to [https://neon.tech](https://neon.tech) → **Sign up**
2. Create a new project
3. Copy the **Connection String** from the dashboard
4. Create a database called `pok_team_builder`:
```bash
psql <your-connection-string> -c "CREATE DATABASE pok_team_builder;"
```

**Option A3: Railway**
1. Go to [https://railway.app](https://railway.app)
2. Sign in with GitHub → **New Project** → **Provision PostgreSQL**
3. In the Postgres plugin, go to **Connect** tab and copy the PostgreSQL URL

#### Step 3: Deploy to Vercel

1. Go to [https://vercel.com/import/git](https://vercel.com/import/git)
2. Click **Continue with GitHub** and authorize Vercel
3. Search for your repo (`pok-team-builder`) and click **Import**
4. In **Environment Variables**, add:
   - `DATABASE_URL`: Paste your PostgreSQL connection string from step 2
   - `JWT_SECRET`: Generate a random secret:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
   - `COOKIE_SECURE`: `true`
5. Click **Deploy**

Vercel will build and deploy automatically. Wait for the green checkmark ✓.

#### Step 4: Initialize the database

After deploy succeeds:

1. Go to your Vercel dashboard → your project
2. Click the **Deployments** tab
3. Find the latest deployment and click **View Deployment**
4. Your site is now live at `https://<your-project>.vercel.app`

The first deployment runs migrations automatically (via `npm run prisma:migrate && npm run db:seed`). 

**To manually seed now (optional):**
```bash
DATABASE_URL="<your-connection-string>" npx prisma db push
DATABASE_URL="<your-connection-string>" npx tsx prisma/seed.ts
```

#### Step 5: Verify it works

1. Open your Vercel URL (e.g., `https://pok-team-builder.vercel.app`)
2. Register a new account
3. Create a team
4. Reload the page — data should persist
5. Success! 🎉

#### Updating your site

Every time you push to GitHub, Vercel auto-deploys:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

---

### Option B: Deploy on Render (Alternative)

GitHub alone cannot host a full-stack app (it needs Node runtime + Postgres), so use GitHub as source and Render as host.

#### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

#### Step 2: Deploy on Render
1. Go to [https://render.com](https://render.com)
2. Click **New +** → **Blueprint**
3. Select your GitHub repo
4. Render reads `render.yaml` and creates:
   - a Node web service
   - a managed Postgres database
5. Wait for first deploy to finish (migrations + seed run automatically)

#### Step 3: Verify
Open the Render URL (`https://<your-service>.onrender.com`) and test:
- Register
- Login
- Create/save a team
- Reload and confirm data persists

#### Required env vars (auto-set by `render.yaml`)
- `DATABASE_URL` (from Render Postgres)
- `JWT_SECRET` (auto-generated)
- `COOKIE_SECURE=true`

## Tests
Run unit tests for weakness and move coverage logic:
```bash
npm test
```

## API Summary
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/:teamId`
- `PUT /api/teams/:teamId`
- `DELETE /api/teams/:teamId`
- `GET /api/teams/:teamId/versions`
- `GET /api/teams/:teamId/versions/:versionId`
- `POST /api/teams/:teamId/versions/:versionId/restore`
- `GET /api/data/bootstrap`

## Notes
- PokeAPI is the canonical source for seeded type/species/move/item/ability data.
- Constraints for OU/UU/VGC are implemented as editable local rule sets in `src/lib/formats.ts`.
- Damage model for MVP analytics uses type effectiveness only (`2x / 0.5x / 0x`), as requested.
