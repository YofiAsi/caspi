from __future__ import annotations

from splitwise_manager.domain.repositories.credentials import CredentialsRepository
from splitwise_manager.infrastructure.credentials_provider import client_for, resolve_creds
from splitwise_manager.infrastructure.splitwise_client import Group, SplitwiseAPIError


async def list_groups(*, creds_repo: CredentialsRepository) -> list[Group]:
    resolved = await resolve_creds(creds_repo.load)
    if resolved is None:
        raise SplitwiseAPIError("splitwise is not connected")
    client = client_for(resolved)
    return await client.get_groups()
