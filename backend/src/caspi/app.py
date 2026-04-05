from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from starlette.middleware.sessions import SessionMiddleware

from caspi import settings
from caspi.infrastructure.database import async_session_factory
from caspi.infrastructure.models import UserModel
from caspi.interfaces.routers.auth import api_router as auth_api_router, public_router as auth_public_router
from caspi.interfaces.routers.tags import router as tags_router
from caspi.interfaces.routers.merchants import router as merchants_router
from caspi.interfaces.routers.collections import router as collections_router
from caspi.interfaces.routers.expenses import router as expenses_router
from caspi.interfaces.routers.credentials import router as credentials_router
from caspi.interfaces.routers.scrape import router as scrape_router
from caspi.interfaces.routers.analytics import router as analytics_router

app = FastAPI()

# ── Middleware ─────────────────────────────────────────────

app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET, https_only=settings.SESSION_COOKIE_SECURE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_guard(request: Request, call_next):
    path = request.url.path

    # Public paths — no auth required
    if path.startswith("/auth") or path == "/health" or path.startswith("/docs") or path.startswith("/openapi"):
        return await call_next(request)

    if not path.startswith("/api"):
        return await call_next(request)

    # Protected /api/* paths
    if settings.AUTH_ENABLED:
        user_id = request.session.get("user_id")
        if not user_id:
            return JSONResponse({"error": "UNAUTHORIZED"}, status_code=401)
        request.state.user_id = uuid.UUID(user_id)
    else:
        # Dev mode: auto-create/fetch dev user
        async with async_session_factory() as db:
            result = await db.execute(select(UserModel).where(UserModel.email == settings.DEV_USER_EMAIL))
            user = result.scalar_one_or_none()
            if user is None:
                user = UserModel(id=uuid.uuid4(), email=settings.DEV_USER_EMAIL)
                db.add(user)
                await db.commit()
                await db.refresh(user)
            request.state.user_id = user.id

    return await call_next(request)


# ── Routes ─────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# Auth (public + protected)
app.include_router(auth_public_router)
app.include_router(auth_api_router)

# Domain routers
app.include_router(tags_router)
app.include_router(merchants_router)
app.include_router(collections_router)
app.include_router(expenses_router)
app.include_router(credentials_router)
app.include_router(scrape_router)
app.include_router(analytics_router)
