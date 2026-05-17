from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import httpx

log = logging.getLogger(__name__)


class SplitwiseManagerUnavailable(Exception):
    """Raised when the splitwise-manager service cannot fulfill a request."""


class SplitwiseManagerError(Exception):
    """Raised when the manager returned a 4xx for a request (caller-side problem)."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(f"splitwise-manager {status_code}: {detail}")
        self.status_code = status_code
        self.detail = detail


class SplitwiseManagerClient:
    """Async httpx wrapper around the splitwise-manager service HTTP API."""

    def __init__(self, base_url: str | None, timeout: float = 10.0) -> None:
        self._base_url = (base_url or "").rstrip("/")
        self._timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self._base_url)

    def _url(self, path: str) -> str:
        return f"{self._base_url}{path}"

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict | None = None,
        params: dict | None = None,
    ) -> Any:
        if not self.configured:
            raise SplitwiseManagerUnavailable("SPLITWISE_MANAGER_URL is not configured")
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.request(method, self._url(path), json=json, params=params)
        except httpx.HTTPError as e:
            raise SplitwiseManagerUnavailable(str(e)) from e

        if resp.status_code >= 500:
            raise SplitwiseManagerUnavailable(
                f"splitwise-manager returned {resp.status_code}: {resp.text[:200]}"
            )
        if resp.status_code >= 400:
            detail = resp.text
            try:
                detail = resp.json().get("detail", detail)
            except Exception:
                pass
            raise SplitwiseManagerError(resp.status_code, str(detail))
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    async def get_status(self) -> dict:
        return await self._request("GET", "/status")

    async def connect(
        self,
        *,
        consumer_key: str | None = None,
        consumer_secret: str | None = None,
        api_key: str | None = None,
    ) -> dict:
        return await self._request(
            "POST",
            "/connect",
            json={
                "consumer_key": consumer_key,
                "consumer_secret": consumer_secret,
                "api_key": api_key,
            },
        )

    async def disconnect(self) -> None:
        await self._request("POST", "/disconnect")

    async def list_groups(self) -> dict:
        return await self._request("GET", "/groups")

    async def share(self, body: dict) -> dict:
        return await self._request("POST", "/share", json=body)

    async def unshare(self, payment_id: UUID, *, delete_remote: bool) -> dict:
        return await self._request(
            "DELETE",
            f"/share/{payment_id}",
            params={"delete_remote": str(delete_remote).lower()},
        )

    async def get_rule(self, merchant_id: UUID) -> dict | None:
        try:
            return await self._request("GET", f"/rules/{merchant_id}")
        except SplitwiseManagerError as e:
            if e.status_code == 404:
                return None
            raise

    async def put_rule(self, merchant_id: UUID, body: dict) -> dict:
        return await self._request("PUT", f"/rules/{merchant_id}", json=body)

    async def delete_rule(self, merchant_id: UUID) -> None:
        await self._request("DELETE", f"/rules/{merchant_id}")

    async def apply_rule(self, body: dict) -> dict:
        return await self._request("POST", "/rules/apply", json=body)

    async def list_failed(self, limit: int = 100) -> dict:
        return await self._request("GET", "/outbox/failed", params={"limit": limit})

    async def retry(self, payment_id: UUID) -> dict:
        return await self._request("POST", f"/retry/{payment_id}")
