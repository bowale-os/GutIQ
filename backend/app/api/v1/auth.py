from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from datetime import timedelta


from app.db import get_session
from app.core.security import hash_password, verify_password, create_access_token
from app.models import User
from app.schemas import UserCreateRequest, TokenResponse, UserUpdateRequest, LogInRequest
from app.core.config import settings


router = APIRouter()

@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(payload:UserCreateRequest, db: AsyncSession = Depends(get_session)):
    
    # Check if user exists
    try:
        stmt = select(User).where(User.email == payload.email)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
        )
        db.add(user)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not create user")

    await db.refresh(user)

    token = create_access_token(subject=str(user.id), expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LogInRequest, db: AsyncSession = Depends(get_session)):
    try:
        stmt = select(User).where(User.email == payload.email)
        result = await db.execute(stmt)
        user: User | None = result.scalar_one_or_none()

        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = create_access_token(subject=str(user.id), expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS))
        return TokenResponse(access_token=token)
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not complete login")
