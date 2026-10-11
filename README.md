# Fireflies Commitments · concept prototype

**Commitments** is a proposed Fireflies.ai feature, built for the Airtribe AI-First Product Management capstone. It is a concept prototype, not an official Fireflies product.

The problem it tackles is that a promise made in a meeting ("I'll fix the UI by tomorrow") ends up as one line in a summary email, and nobody owns it. Commitments turns each one into an item the owner has confirmed. It then follows the item until it closes honestly, in one of three ways: **done**, **handed over**, or **deliberately dropped**. The owner can act from Slack, Microsoft Teams, email or Fireflies itself, and every action syncs to Fireflies and Jira.

Fireflies already records meetings and extracts transcripts, summaries and action items, so this project does not re-do that AI work. A meeting comes in as a file in Fireflies' output format, such as `database/sample-meetings/release-in-5-days.json`, and everything after that is what this feature adds.

## What it does

| | |
|---|---|
| **Confirm first** | Every commitment starts as *Suggested*. The owner gets a card to Confirm, Confirm + Jira, change the date, reassign, mark it "Not a commitment", or Drop it. Nobody is assigned work they did not agree to. |
| **Reminders on the date they said** | The commitment goes to its owner the same day as the meeting. Once confirmed: one "Due tomorrow" reminder the working day before, and the last one at 9:30 AM on the due date (weekend dates on Friday). |
| **No silent drops** | No reply after 1 working day triggers one nudge. After 2 working days it goes to the manager, who is told and assigns it from *Needs an owner*. |
| **Hand-overs need consent** | When an item is reassigned, the new owner must accept. If they decline or don't answer in 2 working days, it goes back to the owner. A second failed hand-over sends it to the manager. |
| **Dependencies and timelines** | "Once Arjun's fixes are in, I'll test in 2 days" links Neha's item to Arjun's. Every person sees the chain with its dates. A reassigned item keeps its date. If a date moves later, every later step moves by the same number of days, Jira due dates are updated, and the affected people are told. |
| **Synced everywhere** | Slack buttons, Teams and email links, the Fireflies app and Jira all change the same record. In Jira: the issue is created with "Owner: <name>", every change is a comment, due dates, owner and "blocks" links stay in step, and Done, reopen and date changes made in Jira come back. Open screens update live. |
| **Manager view** | The manager sees All / Pending / Resolved / Needs an owner for the team. They don't rank people; they only assign items that have no owner. |
| **Friday report** | Each team gets an email listing commitments assigned, resolved, remaining and overdue. |

## Project structure

```
fireflies-commitments/
├── frontend/                 React + Vite (TypeScript)
│   └── src/
│       ├── App.tsx           app shell; /act page for Teams/email buttons
│       ├── store.tsx         data from /api/state + live updates (Server-Sent Events)
│       ├── components/       Shell (sidebar, concept bar), CommitmentRow (+ timeline), ui
│       └── views/            Home, Meetings, Meeting, Commitments, Settings, RightPanel, ImportDialog, ActPage
├── backend/                  Node.js + Express (TypeScript, run with tsx)
│   └── src/
│       ├── index.ts          server: API, webhooks, serves the built frontend
│       ├── config.ts         environment variables
│       ├── db.ts             PostgreSQL (pg): load/save, settings
│       ├── events.ts         live updates to open browsers
│       ├── domain/
│       │   ├── engine.ts     the commitment state machine + reminder rules
│       │   ├── service.ts    load → change → save → send → Jira → notify browsers
│       │   ├── clock.ts      demo clock ("Next morning 9:30")
│       │   ├── seed.ts       demo organisation (8 teams, 9 meetings)
│       │   └── importMeeting.ts   Fireflies meeting file → commitments + cards
│       ├── notify/render.ts  Slack Block Kit, Teams Adaptive Card, email HTML, Friday report
│       ├── integrations/     slack.ts, teams.ts, email.ts (SMTP via Nodemailer), jira.ts
│       ├── routes/           api.ts (app), hooks.ts (Slack, Jira, action links)
│       └── jobs/scheduler.ts hourly reminders, Friday 5:30 PM report
├── shared/core.ts            types, dates, wording and buttons shared by both sides
├── database/
│   ├── schema.sql            PostgreSQL schema (applied automatically on start)
│   └── sample-meetings/      Fireflies-format meeting files to import
├── docs/SETUP.md             deploy (Neon + Render + your domain) and connect Slack, Teams, Jira, email
├── docker-compose.yml        local PostgreSQL
└── render.yaml               Render blueprint
```

## Run locally

```bash
docker compose up -d                 # PostgreSQL on :5432
cp .env.example .env                 # DATABASE_URL already points at it
npm run install:all
npm run dev:backend                  # API on http://localhost:3000 (creates tables + demo data)
npm run dev:frontend                 # app on http://localhost:5173
```

Messages are sent for real once at least one channel is connected: add the Slack keys (and optionally Teams, SMTP email, Jira) to `.env`, then your Slack member ID on the Settings page (see `docs/SETUP.md`). If a team's own channel is not connected, its messages go to Slack, then email. Settings → *Sent messages* shows what went out and where. Without Jira keys, issue keys are simulated.

## Deploy

See **[docs/SETUP.md](docs/SETUP.md)**. In short: Neon (free PostgreSQL), then Render (free web service from this repo), then your domain as a CNAME, then the Slack app, Teams webhook, Jira webhook and SMTP key.

## API

| Method | Path | Used by |
|---|---|---|
| GET | `/api/state` | app: everything the screens need |
| GET | `/api/events` | app: live updates (SSE) |
| POST | `/api/action` | app: `{action, id, actor, extra}`. Actions: confirm, push_tracker, edit_date, snooze, reassign, accept, decline, done, drop, not_commitment, unlink, keep_waiting, claim |
| POST | `/api/clock/next-morning` | demo clock to the next working day 9:30 AM, then sends due reminders |
| POST | `/api/meetings/import` | import a Fireflies meeting file |
| POST | `/api/teams/:id` | manager: channel (slack / teams / email) and tracker (jira / asana / none) |
| POST | `/api/settings` | demo routing, which teams send real messages |
| POST | `/api/report/:teamId/send` | email the Friday report now |
| POST | `/api/demo/reset` | reload demo data |
| POST | `/api/slack/interactions` | Slack buttons (signed requests) |
| POST | `/api/jira/webhook?secret=` | Jira issue moved to Done / due date changed |
| GET/POST | `/api/link` | Teams and email buttons (`/act` page) |

## Notes

- **Demo routing.** Everyone's Slack messages go to one Slack account, and emails go to one inbox, each opening with the person's name ("Hey Neha, just a quick reminder…"). In production each person would get their own. When a button is pressed in demo mode, the person acting is the one the message was for.
- **Teams buttons** open a secure page in the app (`/act`), because cards posted by a webhook cannot call an app back. Product prototypes usually handle it this way.
- **Asana** is simulated. Jira is real once its keys are set.
