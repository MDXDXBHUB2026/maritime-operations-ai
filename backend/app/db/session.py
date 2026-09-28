"""Engine/session construction. DATABASE_URL selects SQLite (default) or PostgreSQL."""

from __future__ import annotations

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base


def build_engine(database_url: str) -> Engine:
    kwargs: dict = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if ":memory:" in database_url:
            # One shared connection, otherwise each connection gets an empty in-memory database.
            kwargs["poolclass"] = StaticPool
    engine = create_engine(database_url, **kwargs)
    if database_url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover - driver hook
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    return engine


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db(engine: Engine) -> None:
    # Phase 1 uses create_all; introduce Alembic migrations before the first PostgreSQL deployment.
    from app.db import models  # noqa: F401 - register tables

    _check_schema_compatible(engine)
    Base.metadata.create_all(engine)


def _check_schema_compatible(engine: Engine) -> None:
    """Minimal additive upgrade for development databases created by an earlier version.

    Missing *nullable* columns are added with ALTER TABLE (safe, no data change). Anything else
    fails fast with a clear message. Alembic migrations replace this before shared deployments.
    """
    import logging

    from sqlalchemy import inspect, text

    log = logging.getLogger("maritime_ai.db")
    inspector = inspect(engine)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        missing = [c for c in table.columns if c.name not in existing]
        blocking = [c.name for c in missing if not c.nullable]
        if blocking:
            raise RuntimeError(
                f"Database schema is out of date: table '{table.name}' is missing required columns "
                f"{sorted(blocking)}. For local SQLite, delete backend/maritime_ai.db and restart (dev data only)."
            )
        with engine.begin() as conn:
            for column in missing:
                ddl = column.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {ddl}'))
                log.warning("Added missing column %s.%s", table.name, column.name)
