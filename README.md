# Caspi

A personal finance app for collecting, categorizing, and analyzing payments from Israeli credit cards. Caspi auto-scrapes Isracard transactions on a schedule, lets you tag and group payments into categories, projects, and ad-hoc collections, and surfaces spending trends through a mobile-first web UI.

Single-user by design — built around one Google identity, no multi-tenant accounts.

## Architecture

Three services orchestrated via Docker Compose:

```
caspi/
├── backend/      Python 3 / FastAPI — DDD layout, async SQLAlchemy
├── frontend/     React 19 + Vite + Tailwind v4, served by nginx
├── scraper/      Node.js / Express wrapping israeli-bank-scrapers + puppeteer
├── docker-compose.yml       (production / Dokploy)
└── docker-compose.dev.yml   (local development)
```

Service topology:

- **frontend** — React SPA (port 3000 internally, exposed via Traefik in prod)
- **backend** — FastAPI app, talks to Postgres and the scraper service
- **scraper** — isolated Node service that runs headless Chromium to fetch Isracard data and streams progress over SSE
- **db** — PostgreSQL 16

The scraper is split out so the backend never needs Chromium and so puppeteer's resource profile stays sandboxed.

### Backend layers (DDD)

```
domain/          Pure business logic — entities, value objects, domain services, repository interfaces
application/     Use cases — scrape orchestration, payment reads/updates, aggregations, collection stats
infrastructure/  SQLAlchemy models, repository implementations, DB session
interfaces/      FastAPI app, routers, request/response schemas, auth middleware
```

The domain layer has no I/O and no framework imports. All spending analysis runs on `Payment.effective_amount`, which transparently substitutes `shared_payment.my_share` when a payment has been marked shared.

## Key Domain Concepts

- **Payment** — a single transaction (amount, date, description, source, merchant). May be categorized, shared, tagged, and assigned to one or more collections.
- **Category** — hierarchical label for classifying payments (parent + sub-categories).
- **Project** — a long-lived financial context (e.g. "Everyday", "Italy 2026") that scopes payments and analysis.
- **Collection** — an ad-hoc grouping of payments with its own stats view (`application/collections/stats.py`).
- **MerchantRule** — learned mapping from a canonical merchant name to a category; powers auto-categorization on import.
- **SharedPayment** — marks a payment as split with someone else; only `my_share` counts in summaries and trends.
- **Tag** — free-text label, many-per-payment, used for filtering and tag-sliced aggregations (monthly and full-range).
- **ImportBatch** — provenance record for each scrape run.

## Features

- **Auto-scrape** — background job runs every `AUTO_SCRAPE_INTERVAL_MINUTES` and pulls the last `AUTO_SCRAPE_LOOKBACK_DAYS` of Isracard transactions to keep the DB fresh.
- **Bulk historical sync** — one-shot scrape across a wide date range, bounded by `ISRACARD_FULL_SYNC_MAX_MONTHS`, with rate-limit and browser-recycling controls.
- **Streaming scrape progress** — scraper exposes Server-Sent Events; the backend relays status updates to the UI.
- **Auto-categorization** — `MerchantRule`s learned from past assignments categorize new payments on import.
- **Analytics** — monthly summaries, spend bar charts, tag breakdowns, and trend services in `domain/services/`.
- **Mobile-first UI** — bottom nav, collapsing header, dialog-based editing; pages for Home, Expenses, Analytics, Monthly Breakdown, Collections, and Settings.
- **Google OAuth gate** — single allowed Google account in production; locked behind `AuthGate` in the SPA.

## Running Locally

1. Copy `.env.example` to `.env` and fill in values (Postgres credentials, Isracard credentials, Google OAuth if testing auth).

   ```bash
   cp .env.example .env
   ```

2. Bring up the dev stack:

   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

   - Backend: http://localhost:8000
   - Frontend: http://localhost:3000
   - Postgres: localhost:5432

The production compose file (`docker-compose.yml`) is wired for Dokploy + Traefik and does not expose ports directly.

## Environment Variables

Database:

| Variable | Description |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials |
| `DATABASE_URL` | Async SQLAlchemy URL (`postgresql+asyncpg://...`) |

Scraper:

| Variable | Description |
|---|---|
| `SCRAPER_URL` | Internal URL the backend uses to reach the scraper service |
| `ISRACARD_ID` / `ISRACARD_CARD6_DIGITS` / `ISRACARD_PASSWORD` | Isracard login credentials |
| `ISRACARD_FULL_SYNC_MAX_MONTHS` | Cap on bulk sync range (0 = no limit, default 120) |
| `ISRACARD_RATE_LIMIT_JSON` | Optional JSON overrides for puppeteer/scraper rate limiting |

Auto-scrape:

| Variable | Description |
|---|---|
| `AUTO_SCRAPE_ENABLED` | Toggle the background job |
| `AUTO_SCRAPE_INTERVAL_MINUTES` | How often the job runs |
| `AUTO_SCRAPE_LOOKBACK_DAYS` | Window of recent days to refresh on each run |

Auth (enforced when `ENVIRONMENT=production` or `AUTH_FORCE_ENABLE=true`):

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `ALLOWED_GOOGLE_EMAIL` | The single email permitted to sign in |
| `SESSION_SECRET` | Cookie-session signing key |
| `PUBLIC_APP_URL` | Public origin used for OAuth redirect |
| `OAUTH_GOOGLE_REDIRECT_PATH` | OAuth callback path; must match the URI registered in Google Cloud |
| `PUBLIC_APP_TRUSTED_HOSTS` / `PUBLIC_APP_TRUSTED_HOST_SUFFIXES` | Allow OAuth via tunnels (e.g. ngrok) |
| `SESSION_COOKIE_SECURE` | Set to `true` behind HTTPS |

## Development Notes

- Domain logic is covered by unit tests in `backend/tests/domain/`.
- Database migrations live in `backend/alembic/`.
- Currency is ILS throughout; no multi-currency support.
- The frontend uses TanStack Query for server state and Radix UI primitives styled with Tailwind v4.
