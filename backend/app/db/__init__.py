# app/db/__init__.py

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.models import User, Log, FoodEntry, SymptomEntry, WellnessEntry
from app.models.confirmed_trigger import ConfirmedTrigger                                  # noqa: F401
from app.models.pain_relief import PainReliefSession, PainReliefChunk, PainReliefFeedback  # noqa: F401
from app.models.gut_check import GutCheckSession, GutCheckMessage                          # noqa: F401
from app.core.config import settings

async_engine = None
AsyncSessionLocal = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global async_engine, AsyncSessionLocal

    async_engine = create_async_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False,
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    print("✓ Database connected")
    yield

    await async_engine.dispose()
    print("✓ Database disconnected")


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise