from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from caspi.interfaces.routers.payments import router as payments_router
from caspi.interfaces.routers.scrape import router as scrape_router
from caspi.interfaces.routers.sharing_rules import router as sharing_rules_router
from caspi.interfaces.routers.tags import router as tags_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scrape_router)
app.include_router(sharing_rules_router)
app.include_router(payments_router)
app.include_router(tags_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
