from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    scraper_url: str
    isracard_id: str
    isracard_card6_digits: str
    isracard_password: str

    environment: str = "development"
    auth_force_enable: bool = False

    google_client_id: str | None = None
    google_client_secret: str | None = None
    allowed_google_email: str | None = None
    session_secret: str | None = None
    public_app_url: str | None = None
    session_cookie_secure: bool = False

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
        if missing:
            raise ValueError(
                "When auth is enabled (ENVIRONMENT=production or AUTH_FORCE_ENABLE=true), "
                f"set: {', '.join(missing)}"
            )
        return self


settings = Settings()
