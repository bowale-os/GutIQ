from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta


from app.db import get_session
from app.core.security import hash_password, verify_password, create_access_token
from app.models import User
from app.schemas import UserCreateRequest, TokenResponse, UserUpdateRequest, LogInRequest
from app.core.config import settings


router = APIRouter()


@router.get("/check-username", status_code=200)
async def check_username(
    username: str = Query(..., min_length=3, max_length=30),
    db: AsyncSession = Depends(get_session),
):
    """Returns {"available": bool} — used by the signup form for real-time feedback."""
    result = await db.execute(select(User).where(User.username == username.lower()))
    taken = result.scalar_one_or_none() is not None
    return {"available": not taken}


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(payload: UserCreateRequest, db: AsyncSession = Depends(get_session)):
    # Check username uniqueness
    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Check email uniqueness only if provided
    if payload.email:
        result = await db.execute(select(User).where(User.email == payload.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(subject=str(user.id), expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS))
    return TokenResponse(access_token=token, user_id=str(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LogInRequest, db: AsyncSession = Depends(get_session)):
    # identifier can be username or email
    identifier = payload.identifier.strip().lower()
    stmt = select(User).where(
        or_(User.username == identifier, User.email == identifier)
    )
    result = await db.execute(stmt)
    user: User | None = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=str(user.id), expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS))
    return TokenResponse(access_token=token, user_id=str(user.id))
