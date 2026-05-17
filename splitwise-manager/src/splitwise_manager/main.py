import logging

from fastapi import FastAPI

from splitwise_manager.api.routes import router
from splitwise_manager.infrastructure.crypto import CryptoError, validate_encryption_key

log = logging.getLogger(__name__)

app = FastAPI(title="splitwise-manager")
app.include_router(router)


@app.on_event("startup")
def _check_encryption_key() -> None:
    try:
        validate_encryption_key()
    except CryptoError as e:
        log.error(
            "CREDENTIALS_ENCRYPTION_KEY is invalid; Splitwise connect will fail until fixed: %s",
            e,
        )


@app.get("/health")
async def health():
    return {"status": "ok"}
