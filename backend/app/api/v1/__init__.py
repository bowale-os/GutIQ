from fastapi import APIRouter
from app.api.v1 import auth, onboarding, log, user


api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(log.router, prefix="/log", tags=["log"])
api_router.include_router(user.router, prefix="/users", tags=["users"])