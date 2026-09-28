"""FastAPI dependencies. Per-request DB session; shared repository, provider and manager agent."""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.agents.manager_agent import ManagerAgent
from app.domain.errors import ForbiddenError, UnauthorizedError
from app.domain.models import Principal
from app.security.permissions import ADMIN_ROLES
from app.services.auth_service import AuthService
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


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
def get_auth_service(
    request: Request,
    session: Session = Depends(get_session),
    maritime: MaritimeService = Depends(get_maritime_service),
) -> AuthService:
    return AuthService(session, request.app.state.settings, maritime.site_by_id)


def get_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise UnauthorizedError("Authentication required")
    return token.strip()


def get_current_principal(
    token: str = Depends(get_bearer_token), auth: AuthService = Depends(get_auth_service)
) -> Principal:
    return auth.authenticate(token)


def require_admin(principal: Principal = Depends(get_current_principal)) -> Principal:
    if principal.role not in ADMIN_ROLES:
        raise ForbiddenError("Administrator role required")
    return principal
