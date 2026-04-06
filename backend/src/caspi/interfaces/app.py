import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from caspi.interfaces.auth_middleware import RequireSessionMiddleware
from caspi.interfaces.routers.auth import (
    google_callback,
    register_google_oauth,
    router as auth_router,
)
from caspi.interfaces.routers.collections import router as collections_router
from caspi.interfaces.routers.merchants import router as merchants_router
from caspi.interfaces.routers.payments import router as payments_router
from caspi.interfaces.routers.scrape import router as scrape_router
from caspi.interfaces.routers.tags import router as tags_router
from caspi.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    if settings.auto_scrape_enabled:
        from caspi.application.auto_scrape import run_auto_scrape_loop

        task = asyncio.create_task(run_auto_scrape_loop())
    yield
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    lifespan=lifespan,
    docs_url=None if settings.auth_enabled else "/docs",
    redoc_url=None if settings.auth_enabled else "/redoc",
    openapi_url=None if settings.auth_enabled else "/openapi.json",
)

if settings.auth_enabled:
    app.add_middleware(RequireSessionMiddleware)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        same_site="lax",
        https_only=settings.session_cookie_secure,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
if settings.auth_enabled and settings.oauth_google_callback_path != "/api/auth/google/callback":
    app.add_api_route(settings.oauth_google_callback_path, google_callback, methods=["GET"])
app.include_router(scrape_router)
app.include_router(merchants_router)
app.include_router(collections_router)
app.include_router(payments_router)
app.include_router(tags_router)

register_google_oauth()


@app.get("/health")
async def health():
    from caspi.application.auto_scrape import get_auto_scrape_status

    return {"status": "ok", "auto_scrape": get_auto_scrape_status()}
