# Caspi — Backend

Python/FastAPI backend for the Caspi payment analysis app. Built with Domain-Driven Design (DDD).

## Tech Stack

- Python 3.12
- FastAPI + Uvicorn
- SQLAlchemy (async) + Alembic
- PostgreSQL 16
- Pydantic v2
- pytest

## Project Layout

```
backend/
├── src/
│   └── caspi/
│       ├── domain/             # Pure domain logic — no I/O, no frameworks
│       │   ├── entities/       # Aggregate roots
│       │   ├── value_objects/  # Immutable value types
│       │   ├── repositories/   # Abstract repository interfaces
│       │   ├── events/         # Domain event dataclasses
│       │   └── services/       # Pure domain services
│       ├── application/        # Use cases (not yet implemented)
│       ├── infrastructure/     # DB models, repo implementations, file parsers (not yet implemented)
│       └── interfaces/         # FastAPI routes and schemas (not yet implemented)
├── tests/
│   └── domain/                 # Unit tests for the domain layer
├── Dockerfile
└── pyproject.toml
```

## Domain Layer

### Entities (aggregate roots)

| Entity | File | Description |
|---|---|---|
| `Payment` | `entities/payment.py` | Core entity — a single financial transaction |
| `Category` | `entities/category.py` | User-defined classification; supports parent/child hierarchy |
| `Project` | `entities/project.py` | Named grouping to track a financial context (e.g. "Vacation") |
| `ImportBatch` | `entities/import_batch.py` | Tracks a file import event and how many payments it produced |
| `MerchantRule` | `entities/merchant_rule.py` | Learned mapping from merchant name to category |

### Value Objects

| Type | File | Description |
|---|---|---|
| `Money` | `value_objects/money.py` | Immutable amount + currency; supports `+`, `-`, `*` |
| `SharedPayment` | `value_objects/shared_payment.py` | Records the user's actual share of a shared expense |
| `Tag` | `value_objects/tag.py` | Normalized (lowercased, stripped) free-text label |
| `PaymentSource` | `value_objects/enums.py` | Enum: `ISRACARD`, `BANK`, `BIT` |
| `PaymentType` | `value_objects/enums.py` | Enum: `RECURRING`, `ONE_TIME`, `UNKNOWN` |
| `DateRange` | `value_objects/date_range.py` | Immutable start/end date pair with `contains()` |
| `*Id` types | `value_objects/ids.py` | Typed UUID wrappers: `PaymentId`, `CategoryId`, `ImportId`, `RuleId`, `ProjectId` |

### Repository Interfaces

All repositories are abstract base classes defined in `domain/repositories/`. Implementations belong in `infrastructure/`.

| Interface | Key methods |
|---|---|
| `PaymentRepository` | `save`, `find_by_id`, `find_by_date_range`, `find_by_category`, `find_by_import`, `find_by_project`, `find_by_tag`, `find_uncategorized` |
| `CategoryRepository` | `save`, `find_by_id`, `find_all` |
| `ProjectRepository` | `save`, `find_by_id`, `find_all` |
| `ImportBatchRepository` | `save`, `find_by_id`, `find_all` |
| `MerchantRuleRepository` | `save`, `find_by_id`, `find_by_merchant_key`, `find_all`, `delete` |
| `TagRepository` | `save`, `find_all` |

### Domain Services

All services are stateless classes that operate purely on domain objects — no I/O.

**`CategorizationService`** (`services/categorization_service.py`)
- Matches a payment's merchant against known `MerchantRule` records
- `RECURRING` rule match → `is_auto=True` (auto-apply the category)
- `ONE_TIME` rule match → `is_auto=False` (suggest the category, require user confirmation)
- No match → `category_id=None` (surface to user for manual categorization)
- Also exposes `normalize_merchant(name: str) -> str` — used everywhere a merchant key is created or looked up

**`SummaryService`** (`services/summary_service.py`)
- `total_by_category(payments)` → list of `CategoryTotal`
- `total_by_month(payments)` → list of `PeriodTotal`
- `total_by_year(payments)` → list of `PeriodTotal`
- `total_by_tag(payments)` → list of `TagTotal`
- `grand_total(payments)` → `Money`
- All methods use `payment.effective_amount` — shared payments are automatically reduced to the user's share

**`TrendService`** (`services/trend_service.py`)
- `monthly_trend(payments, tag=None)` → list of `MonthlyTrend` with month totals and period-over-period change (absolute and %)
- Optionally scoped to a specific `Tag`

### Domain Events

Defined in `domain/events/domain_events.py`. All are frozen dataclasses.

| Event | Payload |
|---|---|
| `PaymentImported` | `payment_id`, `source`, `amount`, `date` |
| `PaymentCategorized` | `payment_id`, `category_id` |
| `MerchantRuleCreated` | `rule_id`, `merchant_key`, `category_id`, `payment_type` |
| `PaymentAssignedToProject` | `payment_id`, `project_id` |

## Key Design Decisions

**`Payment.effective_amount`** — a property that returns `shared_payment.my_share` if the payment is shared, otherwise `amount`. Every analysis method uses this so the user's real cost is always what's computed.

**Merchant normalization** — `normalize_merchant()` in `CategorizationService` is the single source of truth for how a merchant name is normalized into a lookup key. Use it both when creating a `MerchantRule` and when querying for one.

**`PaymentType` on `MerchantRule`** — the rule carries the payment type (RECURRING vs ONE_TIME), not just the payment. This is what controls whether auto-categorization fires.

**Tags are value objects, not entities** — a `Tag` has no UUID. Its normalized name is the identity. `TagRepository` exists only to remember all tags ever used, for autocomplete purposes.

## Running Tests

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/ -v
```

Expected: 27 tests, all passing.

## What Is Not Yet Implemented

- `application/` — use cases (e.g. `ImportPaymentsUseCase`, `CategorizePaymentUseCase`)
- `infrastructure/` — SQLAlchemy ORM models, concrete repository implementations, XLS/CSV file parsers for Isracard, Bank, and Bit
- `interfaces/` — FastAPI app, route definitions, Pydantic request/response schemas
- Alembic migration files (will live in `infrastructure/migrations/`)
