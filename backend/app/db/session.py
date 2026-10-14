import logging
from typing import Generator, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import get_settings

logger = logging.getLogger("tracelens.db")
settings = get_settings()

# Normalize connection string for modern SQLAlchemy + psycopg driver if necessary
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://") and not database_url.startswith("postgresql+"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Configure SQLAlchemy engine with connection pool pre-ping
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    echo=False,
    connect_args={"connect_timeout": 1},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> Tuple[bool, str]:
    """
    Safely ping the PostgreSQL database to verify connectivity.
    Returns (is_connected: bool, message: str).
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "Database connection healthy"
    except SQLAlchemyError as exc:
        logger.warning("Database connection check failed: %s", exc)
        return False, f"Database unavailable: {exc.__class__.__name__}"
    except Exception as exc:
        logger.error("Unexpected error checking database: %s", exc)
        return False, f"Connection error: {str(exc)}"
