"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.neo4j import close_driver
from database.sqlite import init_db
from routers import chat, docs, issues, prs, repos


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    await close_driver()


app = FastAPI(
    title="RepoMind API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repos.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(issues.router, prefix="/api")
app.include_router(docs.router, prefix="/api")
app.include_router(prs.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
