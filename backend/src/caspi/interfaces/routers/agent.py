from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.ai_settings import AIConfigError
from caspi.agent.loop import execute_pending_action, run_agent_loop
from caspi.agent.schemas import ChatRequest, ChatResponse, ExecuteActionRequest
from caspi.infrastructure.database import get_db

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/chat", response_model=ChatResponse)
async def post_chat(body: ChatRequest, db: AsyncSession = Depends(get_db)) -> ChatResponse:
    try:
        return await run_agent_loop(db, body.messages)
    except AIConfigError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e


@router.post("/action/execute", response_model=ChatResponse)
async def post_execute_action(
    body: ExecuteActionRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    try:
        return await execute_pending_action(
            db,
            body.messages,
            body.action_id,
            body.decision,
        )
    except AIConfigError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
