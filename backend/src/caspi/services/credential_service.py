from __future__ import annotations

import json

from cryptography.fernet import Fernet

from caspi import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.CREDENTIALS_ENCRYPTION_KEY
        if not key:
            raise RuntimeError("CREDENTIALS_ENCRYPTION_KEY is not set")
        _fernet = Fernet(key.encode())
    return _fernet


def encrypt_credentials(credentials: dict) -> str:
    return _get_fernet().encrypt(json.dumps(credentials).encode()).decode()


def decrypt_credentials(encrypted: str) -> dict:
    return json.loads(_get_fernet().decrypt(encrypted.encode()).decode())
