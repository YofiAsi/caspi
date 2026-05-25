import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from caspi.interfaces.routers.agent import router as agent_router
from caspi.interfaces.routers.ai_settings import router as ai_settings_router
from caspi.interfaces.routers.collections import router as collections_router
from caspi.interfaces.routers.dev import router as dev_router
from caspi.interfaces.routers.merchants import router as merchants_router
from caspi.interfaces.routers.payments import router as payments_router
from caspi.interfaces.routers.scrape import router as scrape_router
from caspi.interfaces.routers.splitwise import router as splitwise_router
from caspi.interfaces.routers.tags import router as tags_router
from caspi.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    if settings.auto_scrape_enabled:
        from caspi.application.auto_scrape import run_auto_scrape_loop

        task = asyncio.create_task(run_auto_scrape_loop())
    yield
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scrape_router)
app.include_router(merchants_router)
app.include_router(collections_router)
app.include_router(payments_router)
app.include_router(tags_router)
app.include_router(splitwise_router)
app.include_router(dev_router)
app.include_router(agent_router)
app.include_router(ai_settings_router)


@app.get("/health")
async def health():
    from caspi.application.auto_scrape import get_auto_scrape_status

    return {"status": "ok", "auto_scrape": get_auto_scrape_status()}
