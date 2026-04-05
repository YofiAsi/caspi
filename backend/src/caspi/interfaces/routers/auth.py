from __future__ import annotations

import uuid

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi import settings
from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import UserModel

oauth = OAuth()

if settings.AUTH_ENABLED:
    oauth.register(
        name="google",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

# --- public auth routes (no /api prefix) ---

public_router = APIRouter(tags=["auth"])


def _build_redirect_uri(request: Request) -> str:
    forwarded_host = request.headers.get("x-forwarded-host")
    forwarded_proto = request.headers.get("x-forwarded-proto", "http")
    if forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}{settings.OAUTH_GOOGLE_REDIRECT_PATH}"
    return f"{settings.PUBLIC_APP_URL}{settings.OAUTH_GOOGLE_REDIRECT_PATH}"


@public_router.get("/auth/google")
async def login_google(request: Request):
    redirect_uri = _build_redirect_uri(request)
    return await oauth.google.authorize_redirect(request, redirect_uri)


@public_router.get("/auth/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo", {})
    email = userinfo.get("email", "").lower().strip()

    if email not in settings.ALLOWED_EMAILS:
        return JSONResponse({"error": "FORBIDDEN", "message": "Email not authorized"}, status_code=403)

    # Upsert user
    result = await db.execute(select(UserModel).where(UserModel.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = UserModel(id=uuid.uuid4(), email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    request.session["user_id"] = str(user.id)
    request.session["email"] = email

    return RedirectResponse(url="/", status_code=302)


# --- protected auth routes (under /api) ---

api_router = APIRouter(prefix="/api/auth", tags=["auth"])


@api_router.get("/me")
async def me(request: Request):
    return {
        "userId": request.state.user_id,
        "email": request.session.get("email", ""),
    }


@api_router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}
