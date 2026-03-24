from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from caspi.settings import settings

_AUTH_PUBLIC_PATHS: frozenset[str] = frozenset(
    {
        "/health",
        "/api/auth/google",
        "/api/auth/google/callback",
        "/api/auth/me",
        "/api/auth/logout",
    }
)


class RequireSessionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.auth_enabled:
            return await call_next(request)
        path = request.url.path
        if path in _AUTH_PUBLIC_PATHS:
            return await call_next(request)
        if not path.startswith("/api"):
            return await call_next(request)
        email = request.session.get("email")
        if not email:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        return await call_next(request)
