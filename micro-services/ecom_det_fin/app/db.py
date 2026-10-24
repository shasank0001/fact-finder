from __future__ import annotations
from sqlmodel import SQLModel, create_engine, Session
from .config import settings
from pathlib import Path

# Ensure data directory exists for SQLite
if settings.db_url.startswith("sqlite"):
    Path("data").mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.db_url, echo=False, connect_args={"check_same_thread": False} if settings.db_url.startswith("sqlite") else {})

def init_db() -> None:
    # Import tables to register metadata
    from .models import tables  # noqa: F401
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
