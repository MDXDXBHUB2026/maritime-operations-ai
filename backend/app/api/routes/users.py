"""User administration (Administrator role only; administrators hold no approval authority)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.api.deps import get_auth_service, require_admin
from app.domain.models import Principal, UserCreate, UserOut, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/users", tags=["users"])
Admin = Annotated[Principal, Depends(require_admin)]
Auth = Annotated[AuthService, Depends(get_auth_service)]


@router.get("", response_model=list[UserOut])
def list_users(_: Admin, auth: Auth) -> list[UserOut]:
    return auth.list_users()


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, admin: Admin, auth: Auth) -> UserOut:
    return auth.create_user(body, actor=admin)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    body: UserUpdate, admin: Admin, auth: Auth,
    user_id: Annotated[str, Path(pattern=r"^[0-9a-fA-F\-]{36}$")],
) -> UserOut:
    return auth.update_user(user_id, body, actor=admin)
