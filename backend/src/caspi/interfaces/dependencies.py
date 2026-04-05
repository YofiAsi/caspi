from __future__ import annotations

import uuid

from fastapi import Request


def get_user_id(request: Request) -> uuid.UUID:
    return request.state.user_id
