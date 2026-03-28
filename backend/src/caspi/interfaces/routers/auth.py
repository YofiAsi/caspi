import httpx
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from starlette.responses import Response

from caspi.public_request_url import resolve_public_base
from caspi.settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth = OAuth()


def register_google_oauth() -> None:
    if not settings.auth_enabled:
        return
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


async def _google_userinfo(token: dict) -> dict:
    user = token.get("userinfo")
    if user:
        return user
    access = token.get("access_token")
    if not access:
        return {}
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access}"},
        )
        r.raise_for_status()
        return r.json()


@router.get("/google")
async def google_start(request: Request):
    if not settings.auth_enabled:
        raise HTTPException(status_code=404)
    base = resolve_public_base(request)
    request.session["oauth_public_base"] = base
    cb_path = settings.oauth_google_callback_path
    redirect_uri = f"{base}{cb_path}"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request):
    if not settings.auth_enabled:
        raise HTTPException(status_code=404)
    base = request.session.pop("oauth_public_base", None) or (settings.public_app_url or "").rstrip("/")
    token = await oauth.google.authorize_access_token(request)
    user = await _google_userinfo(token)
    email = user.get("email")
    if not email:
        return RedirectResponse(url=f"{base}/?error=no_email", status_code=302)
    allowed = (settings.allowed_google_email or "").strip().lower()
    if email.strip().lower() != allowed:
        return RedirectResponse(url=f"{base}/?error=account_not_allowed", status_code=302)
    request.session["email"] = email
    return RedirectResponse(url=f"{base}/", status_code=302)


@router.get("/me")
async def auth_me(request: Request):
    if not settings.auth_enabled:
        return {"auth_required": False, "email": None}
    email = request.session.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"auth_required": True, "email": email}


@router.post("/logout")
async def auth_logout(request: Request):
    if settings.auth_enabled:
        request.session.clear()
    return Response(status_code=204)
