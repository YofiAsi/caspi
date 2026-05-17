from datetime import date
from decimal import Decimal

import pytest

from caspi.application import scrape_isracard as scr_mod
from caspi.application.scrape_isracard import _maybe_apply_splitwise_rule
from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.enums import PaymentSource
from caspi.domain.value_objects.ids import ImportId, MerchantId, PaymentId
from caspi.domain.value_objects.money import Money
from caspi.infrastructure.splitwise_manager_client import (
    SplitwiseManagerError,
    SplitwiseManagerUnavailable,
)


def _payment() -> Payment:
    return Payment(
        payment_id=PaymentId(),
        amount=Money(Decimal("50.00"), "ILS"),
        date=date(2026, 5, 17),
        description="lunch",
        source=PaymentSource.ISRACARD,
        import_id=ImportId(),
        merchant_id=MerchantId(),
        merchant_canonical_name="cafe",
    )


async def test_hook_noop_when_manager_url_not_configured(monkeypatch):
    monkeypatch.setattr(scr_mod.settings, "splitwise_manager_url", None)
    calls: list = []

    class _Spy:
        def __init__(self, *_a, **_kw):
            calls.append("ctor")

        @property
        def configured(self):
            return False

        async def apply_rule(self, _body):
            calls.append("called")
            return {}

    monkeypatch.setattr(scr_mod, "SplitwiseManagerClient", _Spy)
    await _maybe_apply_splitwise_rule(_payment())
    assert calls == ["ctor"]


async def test_hook_swallows_manager_unavailable(monkeypatch):
    monkeypatch.setattr(scr_mod.settings, "splitwise_manager_url", "http://m")

    class _BrokenClient:
        def __init__(self, *_a, **_kw):
            pass

        @property
        def configured(self):
            return True

        async def apply_rule(self, _body):
            raise SplitwiseManagerUnavailable("down")

    monkeypatch.setattr(scr_mod, "SplitwiseManagerClient", _BrokenClient)
    # must not raise — ingestion must never be blocked
    await _maybe_apply_splitwise_rule(_payment())


async def test_hook_swallows_manager_error(monkeypatch):
    monkeypatch.setattr(scr_mod.settings, "splitwise_manager_url", "http://m")

    class _BadRequestClient:
        def __init__(self, *_a, **_kw):
            pass

        @property
        def configured(self):
            return True

        async def apply_rule(self, _body):
            raise SplitwiseManagerError(400, "bad")

    monkeypatch.setattr(scr_mod, "SplitwiseManagerClient", _BadRequestClient)
    await _maybe_apply_splitwise_rule(_payment())


async def test_hook_calls_apply_rule_with_payment_fields(monkeypatch):
    monkeypatch.setattr(scr_mod.settings, "splitwise_manager_url", "http://m")
    captured: dict = {}

    class _OkClient:
        def __init__(self, *_a, **_kw):
            pass

        @property
        def configured(self):
            return True

        async def apply_rule(self, body):
            captured.update(body)
            return {"shared": True, "my_share_amount": "25.00", "my_share_currency": "ILS"}

    monkeypatch.setattr(scr_mod, "SplitwiseManagerClient", _OkClient)
    p = _payment()
    await _maybe_apply_splitwise_rule(p)
    assert captured["payment_id"] == str(p.payment_id.value)
    assert captured["merchant_id"] == str(p.merchant_id.value)
    assert captured["amount"] == "50.00"
    assert captured["currency"] == "ILS"
    assert captured["date"] == "2026-05-17"
