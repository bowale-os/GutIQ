from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.models import User, Log
from app.core.config import settings

async_engine = create_async_engine(settings.DATABASE_URL)  # ← NO .replace()

engine = create_engine(settings.DATABASE_URL_SYNC, echo=True)

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
