"""
Central declarative base export for SQLAlchemy and Alembic autogenerate discovery.
When new models are created in app.models.*, import them here.
"""
from app.db.session import Base  # noqa: F401
