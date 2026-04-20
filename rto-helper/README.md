# rto-helper (Frontend)

React + Vite frontend for the RTO Agent Automation project.

This app contains:

- Agent routes (`/dashboard`, `/clients`, `/insurance`, `/forms`, `/quotes`, `/revenue`, `/reminders`, `/settings`, `/subscription`)
- Admin routes (`/admin/dashboard`, `/admin/agents`, `/admin/fees`, `/admin/subscriptions`, `/admin/analytics`)

## Run locally

From this directory:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Environment

Optional `.env` keys:

```env
VITE_API_URL=http://localhost:4000/api
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

## Full project docs

For backend setup, Prisma migration/seed, credentials, and root scripts, see:

- `../README.md`
