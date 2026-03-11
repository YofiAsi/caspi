# Caspi

A personal payment collection and analysis web app. Caspi imports payment data from multiple sources (Isracard credit card, bank transactions, Bit transfers), categorizes them, and provides spending summaries and trend analysis.

## Project Structure

```
caspi/
├── backend/          # Python/FastAPI backend — DDD architecture
├── frontend/         # Frontend app (not yet implemented)
├── docker-compose.yml
└── .env.example
```

## Running the Project

1. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

2. Start all services:

```bash
docker compose up --build
```

Services:
- **backend** — FastAPI app at `http://localhost:8000`
- **frontend** — placeholder at `http://localhost:3000`
- **db** — PostgreSQL 16 at `localhost:5432`

## Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `DATABASE_URL` | Full async SQLAlchemy URL (`postgresql+asyncpg://...`) |

## Payment Sources

The app supports three import sources, each with its own file format:

| Source | Format | Description |
|---|---|---|
| `ISRACARD` | XLS | Isracard credit card transaction exports |
| `BANK` | XLS | Bank account transaction exports |
| `BIT` | CSV | Bit peer-to-peer transfer exports |

## Key Domain Concepts

- **Payment** — a single financial transaction with an amount, date, merchant, and optional metadata
- **Category** — a user-defined label for classifying payments (supports sub-categories)
- **Project** — a named financial context to group payments (e.g. "Everyday Life", "Italy Vacation 2026")
- **MerchantRule** — a learned mapping from a merchant name to a category; drives auto-categorization for recurring payments
- **SharedPayment** — marks a payment as shared with others; only the user's actual share (`my_share`) is counted in analysis
- **Tag** — a free-text label on a payment; multiple tags per payment; used for filtering and analysis

## Architecture

The backend follows Domain-Driven Design (DDD) with four layers:

```
domain/         Pure business logic — no I/O, no frameworks
application/    Use cases (not yet implemented)
infrastructure/ Database, file parsers, repository implementations (not yet implemented)
interfaces/     FastAPI routes and request/response schemas (not yet implemented)
```

The domain layer has no external dependencies. All analysis (summaries, trends) operates on `payment.effective_amount`, which automatically accounts for shared payments.

## Agent Notes

- No authentication or login is required — single-user personal app
- The `application/`, `infrastructure/`, and `interfaces/` layers are scaffolded but empty — the next development phase should implement them
- All domain logic is covered by unit tests in `backend/tests/domain/`
- The currency used throughout is ILS (Israeli Shekel) by default
