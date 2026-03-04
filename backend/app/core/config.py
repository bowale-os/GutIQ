from pydantic_settings import BaseSettings
from pydantic import ConfigDict
class Settings(BaseSettings):
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    JWT_SECRET: str 
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    JWT_ALGORITHM: str
    model_config = ConfigDict(env_file=".env")

settings = Settings()
