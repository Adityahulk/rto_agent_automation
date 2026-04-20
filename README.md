# RTO Agent Automation

Full-stack RTO operations platform with:

- Agent web app (clients, calculator, compliance, forms, quotes, revenue, reminders, settings, subscription)
- Admin web app (dashboard, agents, fee engine, subscriptions, analytics)
- Node/Express API + Prisma/PostgreSQL backend

## Repository Structure

- `server` - backend API, Prisma schema/migrations/seed
- `rto-helper` - React + Vite frontend UI (agent + admin routes)

This is the correct split in the current codebase.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, React Query, Recharts
- Backend: Express, Prisma, PostgreSQL, JWT auth
- Utilities: `pdf-lib`, `xlsx`, `multer`

## Prerequisites

- Node.js 18+ (recommended 20+)
- PostgreSQL running locally
- npm

## Environment Setup

### 1) Backend env

Create `server/.env` (or copy `server/.env.example`):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rto_helper?schema=public"
PORT=4000

JWT_AGENT_SECRET="change-me-agent-access"
JWT_AGENT_REFRESH_SECRET="change-me-agent-refresh"
JWT_ADMIN_SECRET="change-me-admin-access"
JWT_ADMIN_REFRESH_SECRET="change-me-admin-refresh"
```

### 2) Frontend env (optional)

Create `rto-helper/.env` as needed:

```env
VITE_API_URL=http://localhost:4000/api
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

If `VITE_API_URL` is omitted, frontend defaults to `/api`.

## Install Dependencies

From repo root:

```bash
npm install
npm install --prefix server
npm install --prefix rto-helper
```

## Database (Prisma)

Run inside `server`:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

## Run in Development

Use two terminals:

### Terminal 1 - backend

```bash
npm run dev
```

This runs `server` dev mode from root scripts.

### Terminal 2 - frontend

```bash
npm run dev:ui
```

Frontend starts on Vite default port (usually `5173`).

## Build

From root:

```bash
npm run build:ui
```

Or directly:

```bash
npm run build --prefix rto-helper
```

## Root Scripts (current)

- `npm run dev` - backend dev (`server`)
- `npm run dev:server` - backend dev (`server`)
- `npm run dev:ui` - frontend dev (`rto-helper`)
- `npm run build:ui` - frontend production build
- `npm run start` - backend start (`server`)

## Seeded Login Credentials

From `server/prisma/seed.ts`:

- Admin
  - Email: `admin@rtohelper.in`
  - Password: `admin123`
- Agent (active)
  - Email: `rajesh@example.com`
  - Password: `agent123`
- Agent (active)
  - Email: `priya@example.com`
  - Password: `agent123`
- Agent (expired)
  - Email: `old@example.com`
  - Password: `agent123`

## API Surface (high level)

- Auth: `/api/auth/*`
- Agent routes: `/api/clients`, `/api/fees`, `/api/dashboard`, `/api/insurance`, `/api/fitness`, `/api/puc`, `/api/permits`, `/api/forms`, `/api/revenue`, `/api/quotes`, `/api/reminders`, `/api/settings`, `/api/subscription`
- Admin routes: `/api/admin/*`

Health check:

- `GET /health`

## Notes

- Uploaded files are served from `/uploads`.
- `forms` route now supports deleting saved forms (`DELETE /api/forms/:id`).
- Mutation toasts are globally handled in frontend API client.

