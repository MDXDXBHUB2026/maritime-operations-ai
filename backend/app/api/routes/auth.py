from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.api.deps import get_auth_service, get_bearer_token, get_current_principal
from app.domain.models import LoginRequest, LoginResponse, MeOut, Principal
from app.security.permissions import approval_matrix
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse, summary="Exchange username/password for a session token")
def login(body: LoginRequest, auth: Annotated[AuthService, Depends(get_auth_service)]) -> LoginResponse:
    token, expires, principal = auth.login(body.username, body.password)
    return LoginResponse(access_token=token, expires_at=expires, user=auth.me(principal))


@router.post("/logout", status_code=204, summary="Revoke the current session")
def logout(
    token: Annotated[str, Depends(get_bearer_token)],
    principal: Annotated[Principal, Depends(get_current_principal)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> Response:
    auth.logout(token, principal)
    return Response(status_code=204)


@router.get("/me", response_model=MeOut, summary="Current user, role and permissions")
def me(
    principal: Annotated[Principal, Depends(get_current_principal)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> MeOut:
    return auth.me(principal)


@router.get("/approval-matrix", summary="Which roles may approve each decision domain")
def get_approval_matrix(_: Annotated[Principal, Depends(get_current_principal)]) -> dict:
    return approval_matrix()
