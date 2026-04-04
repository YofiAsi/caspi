from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_OAUTH_CALLBACK_PATH = "/api/auth/google/callback"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    scraper_url: str
    isracard_id: str
    isracard_card6_digits: str
    isracard_password: str
    isracard_full_sync_max_months: int = 120
    isracard_bulk_cooldown_min_seconds: int = 10
    isracard_bulk_cooldown_initial_seconds: int = 90
    isracard_bulk_cooldown_step_down_seconds: int = 8
    isracard_bulk_cooldown_max_seconds: int = 180
    isracard_bulk_cooldown_tick_seconds: int = 2
    isracard_bulk_automation_retry_seconds: int = 120
    isracard_bulk_cooldown_failure_bump_seconds: int = 25

    environment: str = "development"
    auth_force_enable: bool = False

    google_client_id: str | None = None
    google_client_secret: str | None = None
    allowed_google_email: str | None = None
    session_secret: str | None = None
    public_app_url: str | None = None
    public_app_trusted_hosts: str = ""
    public_app_trusted_host_suffixes: str = ""
    oauth_google_redirect_path: str = _DEFAULT_OAUTH_CALLBACK_PATH
    session_cookie_secure: bool = False

    @property
    def oauth_google_callback_path(self) -> str:
        p = (self.oauth_google_redirect_path or "").strip() or _DEFAULT_OAUTH_CALLBACK_PATH
        if not p.startswith("/"):
            p = "/" + p
        p = p.rstrip("/") or _DEFAULT_OAUTH_CALLBACK_PATH
        return p

    @property
    def trusted_public_hosts(self) -> list[str]:
        return [x.strip() for x in self.public_app_trusted_hosts.split(",") if x.strip()]

    @property
    def trusted_public_host_suffixes(self) -> list[str]:
        return [x.strip() for x in self.public_app_trusted_host_suffixes.split(",") if x.strip()]

    @property
    def auth_enabled(self) -> bool:
        return self.environment == "production" or self.auth_force_enable

    @model_validator(mode="after")
    def validate_auth_when_enabled(self) -> "Settings":
        auth_on = self.environment == "production" or self.auth_force_enable
        if not auth_on:
            return self
        missing: list[str] = []
        if not (self.google_client_id or "").strip():
            missing.append("GOOGLE_CLIENT_ID")
        if not (self.google_client_secret or "").strip():
            missing.append("GOOGLE_CLIENT_SECRET")
        if not (self.allowed_google_email or "").strip():
            missing.append("ALLOWED_GOOGLE_EMAIL")
        if not (self.session_secret or "").strip():
            missing.append("SESSION_SECRET")
        if not (self.public_app_url or "").strip():
            missing.append("PUBLIC_APP_URL")
        cb = self.oauth_google_callback_path
        if ".." in cb or "\n" in cb or " " in cb:
            raise ValueError("OAUTH_GOOGLE_REDIRECT_PATH must not contain .., newlines, or spaces")
        if missing:
            raise ValueError(
                "When auth is enabled (ENVIRONMENT=production or AUTH_FORCE_ENABLE=true), "
                f"set: {', '.join(missing)}"
            )
        return self


settings = Settings()
