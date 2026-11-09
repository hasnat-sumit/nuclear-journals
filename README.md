# Nuclear Journal

An editorial publishing platform for nuclear science, nuclear engineering, nuclear energy, radiation protection and nuclear safety.

Qualified writers submit articles, reviewers evaluate them in confidence, and editors make every publication decision. Anyone can read published articles without an account.

This is an editorial publication, not a formal academic peer-reviewed journal.

## Project status

All seven phases are built and tested locally. It has not been deployed: see [Deploying](#deploying) for what that needs.

## How the pieces fit together

```text
Browser ──> client/ (Next.js, port 3000) ──> server/ (Express, port 4000) ──> MongoDB
```

| Folder    | What it is                                              | Deploys to             |
| --------- | ------------------------------------------------------- | ---------------------- |
| `client/` | The website: pages, components and styling              | Vercel                 |
| `server/` | The REST API: business rules, permissions and data      | A managed Node.js host |

The two apps are separate on purpose. All permission checks live in the API, so hiding something in the website is never the only protection.

The browser only ever talks to the website. Next.js forwards `/api/v1` requests to Express, which keeps login cookies first-party.

The repository uses **npm workspaces**: one `npm install` at the root sets up both apps and creates a single lockfile.

### Backend layout

```text
server/src/
├── config/       Environment variables and database connection
├── constants.ts  Roles and statuses, including the writer-status mapping
├── lib/          Auth, email, HTML sanitizing, shared request helpers
├── middleware/   Login and role checks, error handling
├── models/       Database collections
├── routes/       URLs, validation and thin request handlers
├── services/     Business rules: workflow, assignment, notifications, serializers
├── app.ts        Builds the Express app (tests use this directly)
└── server.ts     Connects to the database and starts listening
```

Handlers live with their routes rather than in separate controller files, because most are only a few lines. Real business rules are in `services/`.

### Frontend layout

Public pages are server-rendered for search engines and always show current data. Dashboards load their data in the browser, because they are private and change often.

## Getting started

You need Node.js 22.12 or newer. No external accounts are needed to run it locally.

```bash
# 1. Install dependencies for both apps
npm install

# 2. Create your local environment files
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# 3. In one terminal, start a local database (keep it running)
npm run dev:db

# 4. In a second terminal, add sample data once, then start both apps
npm run seed
npm run dev
```

Open <http://localhost:3000>. The seed command prints four demo accounts, one for each role.

Locally, emails such as verification links are printed in the terminal running the API.

## Commands

Run these from the repository root.

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev:db`    | Starts a local database, kept in `server/.dev-db` |
| `npm run seed`      | Adds categories, demo accounts and sample articles |
| `npm run dev`       | Starts the API and the website               |
| `npm run lint`      | Checks code style and common mistakes        |
| `npm run typecheck` | Checks TypeScript types in both apps         |
| `npm test`          | Runs the API tests against a real temporary database |
| `npm run build`     | Builds both apps for production              |
| `npm run check`     | Runs lint, types, tests and build            |

To make someone an editor, have them register first, then run:

```bash
npm run make-editor -w server -- person@example.com
```

## Deploying

You will need accounts for MongoDB Atlas, Cloudinary, an email (SMTP) provider, Vercel, and a Node.js host for the API.

**API (Node.js host).** Use the repository root, build with `npm ci && npm run build -w server`, and start with `npm start -w server`. Set these variables, using `server/.env.example` as the guide:

`NODE_ENV=production`, `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_ORIGINS`, `INTERNAL_API_KEY`, `SMTP_URL`, `EMAIL_FROM`, `CLOUDINARY_URL`, `TRUST_PROXY_HOPS`.

The API refuses to start if a required value is missing or still a development default. Use `/api/v1/health` as the host's health check path.

**Website (Vercel).** Set the root directory to `client`. Set `API_URL`, `INTERNAL_API_KEY` (the same value as the API), `SITE_URL` and `CONTACT_EMAIL`.

**First run.** With the API's production variables set, seed the categories with `npm run seed -w server -- --categories-only`, register your own account on the website, then run `make-editor` for it.

## Environment variables

Each app documents its variables in its own `.env.example`. Real `.env` files hold secrets and are ignored by Git.
