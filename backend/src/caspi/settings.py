from __future__ import annotations

import os


def _csv(val: str) -> list[str]:
    return [v.strip() for v in val.split(",") if v.strip()]


DATABASE_URL: str = os.environ["DATABASE_URL"]
SCRAPER_URL: str = os.environ.get("SCRAPER_URL", "http://scraper:3001")

ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")
AUTH_FORCE_ENABLE: bool = os.environ.get("AUTH_FORCE_ENABLE", "false").lower() == "true"
AUTH_ENABLED: bool = ENVIRONMENT == "production" or AUTH_FORCE_ENABLE

GOOGLE_CLIENT_ID: str = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET: str = os.environ.get("GOOGLE_CLIENT_SECRET", "")
ALLOWED_EMAILS: list[str] = _csv(os.environ.get("ALLOWED_EMAILS", os.environ.get("ALLOWED_GOOGLE_EMAIL", "")))
SESSION_SECRET: str = os.environ.get("SESSION_SECRET", "dev-secret-change-me")
PUBLIC_APP_URL: str = os.environ.get("PUBLIC_APP_URL", "http://localhost:3000")
OAUTH_GOOGLE_REDIRECT_PATH: str = os.environ.get("OAUTH_GOOGLE_REDIRECT_PATH", "/auth/callback")
SESSION_COOKIE_SECURE: bool = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"

CORS_ORIGINS: list[str] = _csv(os.environ.get("CORS_ORIGINS", "http://localhost:3000"))

PUBLIC_APP_TRUSTED_HOSTS: list[str] = _csv(os.environ.get("PUBLIC_APP_TRUSTED_HOSTS", ""))
PUBLIC_APP_TRUSTED_HOST_SUFFIXES: list[str] = _csv(
    os.environ.get("PUBLIC_APP_TRUSTED_HOST_SUFFIXES", ".ngrok-free.dev,.ngrok.io,.ngrok.app")
)

# Dev-mode default user (used when AUTH_ENABLED is False)
DEV_USER_EMAIL: str = "dev@localhost"

# Credential encryption (Fernet key, 32-byte url-safe base64)
CREDENTIALS_ENCRYPTION_KEY: str = os.environ.get("CREDENTIALS_ENCRYPTION_KEY", "")
