from __future__ import annotations

from splitwise_manager.domain.repositories.credentials import CredentialsRepository


async def disconnect(*, creds_repo: CredentialsRepository) -> None:
    await creds_repo.delete()
