"""FastAPI dependencies. Per-request DB session; shared repository, provider and manager agent."""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.agents.manager_agent import ManagerAgent
from app.services.decision_service import DecisionService
from app.services.maritime_service import MaritimeService


def get_session(request: Request) -> Iterator[Session]:
    session = request.app.state.session_factory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_maritime_service(request: Request) -> MaritimeService:
    return MaritimeService(request.app.state.repository)


def get_manager_agent(request: Request) -> ManagerAgent:
    return request.app.state.manager_agent


def get_decision_service(
    session: Session = Depends(get_session),
    maritime: MaritimeService = Depends(get_maritime_service),
    manager: ManagerAgent = Depends(get_manager_agent),
) -> DecisionService:
    return DecisionService(session, maritime, manager)
