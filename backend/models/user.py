from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from sqlalchemy import func
import uuid


class User(SQLModel, table=True):
    
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    digestive_condition: Optional[str] = Field(default=None, index=True)
    goal : Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False
        }
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={
            "server_default": func.now(),
            "onupdate": func.now(),
            "nullable": False
        }
    )

