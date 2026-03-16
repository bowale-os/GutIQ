from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db import lifespan, get_session
from app.api.v1 import api_router

app = FastAPI(title="GutIQ API v1", lifespan=lifespan)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173", 
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",  # Add these
    "http://localhost:8000",   # Your backend, if needed for proxy
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
