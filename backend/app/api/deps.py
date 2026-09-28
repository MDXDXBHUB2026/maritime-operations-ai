"""Dependency wiring. All components are built once in ``create_app`` and stored on app.state."""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Path, Request
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.ai.provider import AIProvider
from app.config import Settings
from app.domain.models import ENTITY_ID_PATTERN
from app.services.audit_service import AuditService
from app.services.decision_service import DecisionService
from app.services.maritime_service import MaritimeService


@dataclass
class Container:
    settings: Settings
    engine: Engine
    session_factory: sessionmaker[Session]
    provider: AIProvider
    maritime: MaritimeService
    audit: AuditService
    decisions: DecisionService


def get_container(request: Request) -> Container:
    return request.app.state.container  # type: ignore[no-any-return]


def get_session(container: Annotated[Container, Depends(get_container)]) -> Iterator[Session]:
    session = container.session_factory()
    try:
        yield session
    finally:
        session.close()


def get_maritime(container: Annotated[Container, Depends(get_container)]) -> MaritimeService:
    return container.maritime


ContainerDep = Annotated[Container, Depends(get_container)]
SessionDep = Annotated[Session, Depends(get_session)]
MaritimeDep = Annotated[MaritimeService, Depends(get_maritime)]
EntityId = Annotated[str, Path(pattern=ENTITY_ID_PATTERN, description="Record identifier")]
