import os

from cryptography.fernet import Fernet

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("SCRAPER_URL", "http://localhost:9999")
os.environ.setdefault("ISRACARD_ID", "test")
os.environ.setdefault("ISRACARD_CARD6_DIGITS", "000000")
os.environ.setdefault("ISRACARD_PASSWORD", "test")
os.environ.setdefault("CREDENTIALS_ENCRYPTION_KEY", Fernet.generate_key().decode())
