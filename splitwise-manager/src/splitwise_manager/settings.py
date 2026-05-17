from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str = "redis://redis:6379/0"
    credentials_encryption_key: str

    sw_consumer_key: str | None = None
    sw_consumer_secret: str | None = None
    sw_api_key: str | None = None

    splitwise_retry_max_attempts: int = 8

    @property
    def env_creds_present(self) -> bool:
        return bool(
            (self.sw_consumer_key or "").strip()
            and (self.sw_consumer_secret or "").strip()
            and (self.sw_api_key or "").strip()
        )


settings = Settings()
