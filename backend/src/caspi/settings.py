from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    scraper_url: str
    isracard_id: str
    isracard_card6_digits: str
    isracard_password: str

    model_config = {"env_file": ".env"}


settings = Settings()
