from fastapi import FastAPI

from splitwise_manager.api.routes import router

app = FastAPI(title="splitwise-manager")
app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
