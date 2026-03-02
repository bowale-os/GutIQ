from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db import lifespan, get_session
from app.api.v1 import api_router

app = FastAPI(title="GutIQ API v1", lifespan=lifespan)

# CORS configuration
origins = [
    "http://localhost:3000",  # Add localhost for local dev too
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "GutIQ Backend - Ready for chatbot logging!"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

app.include_router(api_router)
