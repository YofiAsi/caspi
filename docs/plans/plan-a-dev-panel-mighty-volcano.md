# Dev API: manually inject a payment through the sync pipeline

## Context

While developing, it's painful to trigger a real Isracard scrape just to test downstream behavior (merchant canonicalization, aliases, `is_shared` rules, Splitwise hook, response mapping). We want a backend-only dev route that accepts a minimal payment payload (amount, date, description) and pushes it through the **same post-scrape pipeline** so it behaves identically to a freshly synced payment — usable from Postman.

No frontend changes.

## Approach

Add a new `/api/dev/payments` POST endpoint that constructs a single synthetic `Payment` and runs it through the existing scrape-side processing by **reusing `import_isracard_accounts`** in `backend/src/caspi/application/scrape_isracard.py:78`. That function already wires merchant canonicalization → `payment_repo.save` → `_maybe_apply_splitwise_rule`, which is exactly the pipeline we want to mirror. We feed it a one-account, one-txn list shaped like the Isracard scraper output so we get the canonical pipeline for free (no duplicated logic, no drift).

The endpoint is namespaced under `/api/dev` and is the dev gate itself — no settings flag.

## Changes

### 1. New router `backend/src/caspi/interfaces/routers/dev.py`
- `POST /api/dev/payments` accepting:
  ```json
  { "amount": "123.45", "date": "2026-05-17", "description": "Some merchant" }
  ```
  `amount` is the **charged amount as the user sees it on the statement** (positive = expense). Inside, we pass `chargedAmount = -amount` into the synthetic txn so that `import_isracard_accounts` line 97 (`charged_amount = -Decimal(...)`) flips it back to the correct sign — keeping behavior identical to real scrapes.
- Build an `accounts` list with one fake txn:
  ```python
  accounts = [{
      "accountNumber": "dev",
      "txns": [{
          "identifier": f"dev-{uuid4()}",  # unique so dedup at line 95 never skips it
          "chargedAmount": str(-amount),
          "date": f"{iso_date}T00:00:00",
          "description": description,
      }],
  }]
  ```
- Call `import_isracard_accounts(accounts, payment_repo=..., import_batch_repo=..., merchant_repo=...)` with the standard SQL repos (same wiring as `scrape.py:64`), then `await db.commit()`.
- Response: same shape as `ScrapeIsracardResponse` plus the created `payment_id` (read back via `payment_repo.find_by_import(result.import_id)[0]`) and the mapped response from `domain_payment_to_response` so the caller sees the same DTO the listing endpoint returns (with alias applied).

### 2. Register the router in `backend/src/caspi/interfaces/app.py`
Add `from caspi.interfaces.routers.dev import router as dev_router` and `app.include_router(dev_router)` alongside the others (line 65–70).

## Critical files
- `backend/src/caspi/application/scrape_isracard.py` — reused as-is; do not modify.
- `backend/src/caspi/interfaces/routers/dev.py` — new.
- `backend/src/caspi/interfaces/app.py` — one import + one `include_router` line.
- Reference for repo wiring and response shape: `backend/src/caspi/interfaces/routers/scrape.py:63-91`.
- Reference for response mapping: `backend/src/caspi/application/payments/response_mapper.py` (`domain_payment_to_response`).

## Why reuse `import_isracard_accounts` (not a new "create payment" use case)
- It already runs the full pipeline the user wants: merchant `ensure_by_canonical_name`, `Payment` construction with `merchant_canonical_name`, `import_batch` creation, `payment_repo.save`, and `_maybe_apply_splitwise_rule`. Writing a parallel path would duplicate this and drift over time.
- `is_shared` and alias logic both live downstream of `payment_repo.save` (alias via response_mapper, splitwise via the hook on line 144) — both fire automatically.

## Verification
1. Start the stack: `docker compose up -d`.
2. Postman / curl:
   ```
   curl -X POST http://localhost:8000/api/dev/payments \
     -H 'Content-Type: application/json' \
     -d '{"amount":"49.90","date":"2026-05-17","description":"Coffee shop test"}'
   ```
3. Expect 200 with `payment_id`, `import_id`, and a mapped payment DTO.
4. Hit `GET /api/payments` (existing list endpoint) — the new payment appears with the same fields as a scraped one; if the description matches a merchant alias, the alias is shown.
5. If a Splitwise rule matches the merchant and `SPLITWISE_MANAGER_URL` is set, check the splitwise-manager logs — `apply_rule` should fire.
6. Re-POST the same payload — a new payment is created each time (unique synthetic `identifier`), confirming the dev route isn't accidentally hitting the dedup short-circuit.
