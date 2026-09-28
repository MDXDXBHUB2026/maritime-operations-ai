"""FastAPI application factory.

Run locally:  uvicorn app.main:app --reload --port 8000   (from the backend/ directory)
Docs:         http://localhost:8000/docs
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.manager_agent import ManagerAgent
from app.ai.factory import build_provider
from app.api.deps import Container
from app.api.router import API_PREFIX, api_router
from app.config import Settings, get_settings
from app.db.session import build_engine, build_session_factory, init_db
from app.errors import register_error_handlers
from app.repositories.base import MaritimeRepository
from app.repositories.maritime_repository import JsonFileMaritimeRepository
from app.services.audit_service import AuditService
from app.services.decision_service import DecisionService
from app.services.maritime_service import MaritimeService

logging.basicConfig(level=logging.INFO)


def build_container(settings: Settings, repository: MaritimeRepository | None = None) -> Container:
    engine = build_engine(settings.database_url)
    provider = build_provider(settings)
    maritime = MaritimeService(repository or JsonFileMaritimeRepository(settings.data_dir))
    audit = AuditService()
    return Container(
        settings=settings,
        engine=engine,
        session_factory=build_session_factory(engine),
        provider=provider,
        maritime=maritime,
        audit=audit,
        decisions=DecisionService(maritime, ManagerAgent(provider), audit),
    )


def create_app(
    settings: Settings | None = None, repository: MaritimeRepository | None = None
) -> FastAPI:
    settings = settings or get_settings()
    container = build_container(settings, repository)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        init_db(container.engine)
        yield
        container.engine.dispose()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Decision-support API for the Maritime Operations AI control tower. "
            "AI agents propose recommendations; humans review, approve or reject them. "
            "Execution is simulated in this phase."
        ),
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )
    app.state.container = container

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Accept"],
    )
    register_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
