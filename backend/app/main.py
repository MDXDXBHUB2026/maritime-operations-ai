"""FastAPI application factory for the Maritime Operations AI decision-support backend."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.agents.manager_agent import ManagerAgent
from app.ai.provider import build_provider
from app.api.router import api_router
from app.config import Settings, get_settings
from app.db.session import build_engine, build_session_factory, init_db
from app.domain.errors import DomainError
from app.repositories.maritime_repository import JsonFileMaritimeRepository
from app.services.auth_service import seed_demo_users
from app.services.maritime_service import MaritimeService

logger = logging.getLogger("maritime_ai")


def _error(status: int, code: str, message: str, details: object = None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = jsonable_encoder(details)
    return JSONResponse(status_code=status, content=body)


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Decision-support API. AI agents propose recommendations; humans approve or reject. "
            "Execution in Phase 1 is simulated and every state change is audited."
        ),
        docs_url="/docs",
        openapi_url=f"{settings.api_prefix}/openapi.json",
    )

    engine = build_engine(settings.database_url)
    init_db(engine)
    provider = build_provider(settings)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = build_session_factory(engine)
    app.state.repository = JsonFileMaritimeRepository(settings.data_dir)
    app.state.provider = provider
    app.state.manager_agent = ManagerAgent(provider)

    if settings.demo_users_password is not None:
        session = app.state.session_factory()
        try:
            catalog = MaritimeService(app.state.repository).site_by_id
            created = seed_demo_users(session, settings, settings.demo_users_password.get_secret_value(), catalog)
            if created:
                logger.info("Seeded demo users: %s", ", ".join(created))
        finally:
            session.close()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        response = _error(exc.status_code, exc.code, exc.message)
        if exc.status_code == 401:
            response.headers["WWW-Authenticate"] = "Bearer"
        return response

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"loc": e.get("loc"), "msg": e.get("msg"), "type": e.get("type")} for e in exc.errors()]
        return _error(422, "validation_error", "Request validation failed", details)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return _error(500, "internal_error", "An internal error occurred")

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


_app: Optional[FastAPI] = None


def __getattr__(name: str) -> FastAPI:
    """Lazily build the ASGI app for ``uvicorn app.main:app`` without side effects on import."""
    global _app
    if name == "app":
        if _app is None:
            _app = create_app()
        return _app
    raise AttributeError(name)
