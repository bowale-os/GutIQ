from fastapi import APIRouter
from app.api.v1 import auth, onboarding, log, user, pain_relief, gut_check, export


api_router = APIRouter()

api_router.include_router(auth.router,         prefix="/auth",         tags=["auth"])
api_router.include_router(onboarding.router,   prefix="/onboarding",   tags=["onboarding"])
api_router.include_router(log.router,          prefix="/log",           tags=["log"])
api_router.include_router(user.router,         prefix="/users",         tags=["users"])
api_router.include_router(pain_relief.router,  prefix="/pain-relief",   tags=["pain-relief"])
api_router.include_router(gut_check.router,    prefix="/gutcheck",      tags=["gutcheck"])
api_router.include_router(export.router,       prefix="/export",        tags=["export"])