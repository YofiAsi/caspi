from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    scraper_url: str
    isracard_id: str
    isracard_card6_digits: str
    isracard_password: str
    isracard_full_sync_max_months: int = 120

    splitwise_manager_url: str | None = None

    auto_scrape_enabled: bool = True
    auto_scrape_interval_minutes: int = 60
    auto_scrape_lookback_days: int = 2


settings = Settings()
