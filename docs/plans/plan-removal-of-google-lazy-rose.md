# Plan: Remove Google OAuth Authorization

## Context

Caspi runs on a private VPN, so protecting the app with Google OAuth is unnecessary overhead. The goal is to strip out all auth logic — backend middleware, auth router, Google OAuth settings, and the frontend `AuthGate` — so the app loads directly without any login flow.

The existing code already has an `auth_enabled` flag (disabled in development), so the auth layer is well-isolated and cleanly removable.

---

## Files to Modify

### Backend

| File | Change |
|------|--------|
| `backend/src/caspi/interfaces/app.py` | Remove `RequireSessionMiddleware`, `SessionMiddleware`, and auth router registration |
| `backend/src/caspi/settings.py` | Remove all auth-related settings fields and their validation |
| `backend/src/caspi/interfaces/routers/auth.py` | **Delete** entirely |
| `backend/src/caspi/interfaces/auth_middleware.py` | **Delete** entirely |
| `backend/src/caspi/public_request_url.py` | **Delete** (only used for OAuth redirect URL construction) |
| `.env.example` | Remove auth-related env vars |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Remove `<AuthGate>` wrapper; render app directly |
| `frontend/src/components/AuthGate.tsx` | **Delete** entirely |
| `frontend/src/api/client.ts` | Remove `fetchAuthMe()` and `AuthData` type |
| `frontend/src/pages/SettingsPage.tsx` | Remove logout button and `logoutAndRefresh` logic |

---

## Implementation Steps

### 1. Backend — `app.py`
- Remove the `if auth_enabled:` blocks that add `SessionMiddleware` and `RequireSessionMiddleware`
- Remove `auth_router` import and `app.include_router(auth_router)` call
- Remove `register_google_oauth()` call from startup

### 2. Backend — `settings.py`
- Remove fields: `google_client_id`, `google_client_secret`, `allowed_google_email`, `session_secret`, `public_app_url`, `oauth_google_redirect_path`, `session_cookie_secure`, `public_app_trusted_hosts`, `public_app_trusted_host_suffixes`, `auth_force_enable`
- Remove the `auth_enabled` property and its validation logic
- Remove the `authlib` import/usage if any

### 3. Backend — Delete files
- `backend/src/caspi/interfaces/routers/auth.py`
- `backend/src/caspi/interfaces/auth_middleware.py`
- `backend/src/caspi/public_request_url.py`

### 4. Backend — `pyproject.toml` / dependencies
- Remove `authlib` from dependencies if it's only used for Google OAuth

### 5. Frontend — `App.tsx`
- Remove `AuthGate` wrapper; render the router/routes directly
- Remove `AuthContext` provider if it only carries auth data

### 6. Frontend — Delete files
- `frontend/src/components/AuthGate.tsx`

### 7. Frontend — `client.ts`
- Remove `fetchAuthMe()`, `AuthData` type, and any auth-related exports

### 8. Frontend — `SettingsPage.tsx`
- Remove logout button and its handler

### 9. `.env.example`
- Remove all auth-related variable entries

---

## Verification

1. **Start the app** via `docker-compose.dev.yml` — it should boot without errors
2. **Open the browser** — should land directly on the app, no login screen
3. **Call any API endpoint** (e.g. `GET /api/payments`) — should return data with no 401
4. **Check `/api/auth/me`** no longer exists (404)
5. **Run backend tests**: `pytest backend/tests/` — no auth-related test failures
