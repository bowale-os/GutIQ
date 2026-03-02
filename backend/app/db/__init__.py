from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.models import User, Log
from app.core.config import settings

# Sync engine (for alembic/migrations)
engine = create_engine(settings.DATABASE_URL, echo=True)

# Async engine (for FastAPI)
async_engine = create_async_engine(settings.DATABASE_URL)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    await async_engine.dispose()

# Dependency
async def get_session() -> AsyncSession:
    async with AsyncSession(async_engine) as session:
        yield session
