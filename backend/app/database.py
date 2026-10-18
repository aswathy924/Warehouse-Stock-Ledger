from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    postgres_password: str

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

DATABASE_URL = URL.create(
    drivername="postgresql+psycopg",
    username="warehouse_user",
    password=settings.postgres_password,
    host="localhost",
    port=5434,
    database="warehouse_db",
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()