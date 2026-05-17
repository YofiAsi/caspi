from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from splitwise_manager.settings import settings


class CryptoError(Exception):
    pass


def _fernet() -> Fernet:
    key = (settings.credentials_encryption_key or "").strip()
    if not key:
        raise CryptoError("CREDENTIALS_ENCRYPTION_KEY is not set")
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:
        raise CryptoError(f"invalid CREDENTIALS_ENCRYPTION_KEY: {e}") from e


def validate_encryption_key() -> None:
    """Raise CryptoError if CREDENTIALS_ENCRYPTION_KEY is missing or not a Fernet key."""
    _fernet()


def encrypt(plaintext: str) -> bytes:
    return _fernet().encrypt(plaintext.encode("utf-8"))


def decrypt(ciphertext: bytes) -> str:
    try:
        return _fernet().decrypt(ciphertext).decode("utf-8")
    except InvalidToken as e:
        raise CryptoError("failed to decrypt: invalid ciphertext or key") from e
