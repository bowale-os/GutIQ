from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    JWT_SECRET: str
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    JWT_ALGORITHM: str
    ANTHROPIC_API_KEY: str
    DEEPGRAM_API_KEY: str

    # Qdrant Cloud — vector store for the pain relief RAG pipeline
    QDRANT_URL: str
    QDRANT_API_KEY: str

    # Frontend origin — used to build share links (e.g. https://gutiq.vercel.app)
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = ConfigDict(env_file=".env")

settings = Settings()