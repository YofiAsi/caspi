## Cursor Cloud specific instructions

### Services overview

| Service | Tech | Dev port | Start command |
|---------|------|----------|---------------|
| **db** | PostgreSQL 16 | 5432 | `sudo service postgresql start` |
| **backend** | Python 3.12 / FastAPI / Uvicorn | 8000 | See below |
| **frontend** | React 19 / Vite 7 / TypeScript | 3000 | `cd frontend && npm run dev` |
| **scraper** | Node 22 / Express / Puppeteer | 3001 | Optional — only needed for Isracard scraping |

### Running services locally (without Docker)

**PostgreSQL** must be running before the backend starts. Start with `sudo service postgresql start`. The dev database is `caspi` with user `caspi` / password `changeme`.

**Backend** requires several env vars. The `isracard_id`, `isracard_card6_digits`, and `isracard_password` settings fields are **required** (no defaults), so you must supply dummy values even when not scraping:

```
cd backend && source .venv/bin/activate
DATABASE_URL=postgresql+asyncpg://caspi:changeme@localhost:5432/caspi \
SCRAPER_URL=http://localhost:3001 \
ENVIRONMENT=development \
AUTO_SCRAPE_ENABLED=false \
SESSION_SECRET=dev-session-secret \
ISRACARD_ID=dummy \
ISRACARD_CARD6_DIGITS=000000 \
ISRACARD_PASSWORD=dummy \
uvicorn caspi.interfaces.app:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend** proxies `/api/*` and `/auth/*` to the backend via Vite config. Run `cd frontend && npm run dev`.

**Alembic migrations**: Run before first backend start or after pulling new migration files:
```
cd backend && source .venv/bin/activate
DATABASE_URL=postgresql+asyncpg://caspi:changeme@localhost:5432/caspi alembic upgrade head
```

### Testing

- **Backend tests** (50 unit tests, no DB needed): `cd backend && source .venv/bin/activate && pytest tests/ -v`
- **Frontend lint**: `cd frontend && npx eslint .`
- **Frontend build check**: `cd frontend && npm run build`
- No frontend or scraper automated tests exist currently.

### Gotchas

- Auth is **disabled** when `ENVIRONMENT=development` (the default). No Google OAuth setup needed for dev.
- The `.env` file at repo root is used by docker-compose. When running locally, pass env vars directly or source them — the backend `Settings` class reads from env vars with `pydantic-settings`.
- The `DATABASE_URL` must use `postgresql+asyncpg://` scheme (async driver), not `postgresql://`.
- The scraper service is optional for most development work; it only powers the "Scrape from Isracard" feature.
