"""Delegation of approval authority (temporary, per site and domain, fully audited)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.api.deps import get_authority_service, get_current_principal
from app.domain.models import DelegationCreate, DelegationOut, DelegationRevoke, EligibleDelegate, Principal
from app.services.authority_service import AuthorityService

router = APIRouter(prefix="/delegations", tags=["delegations"])
User = Annotated[Principal, Depends(get_current_principal)]
Authority = Annotated[AuthorityService, Depends(get_authority_service)]


@router.get("", response_model=list[DelegationOut],
            summary="Delegations you gave or received (administrators see all)")
def list_delegations(user: User, authority: Authority) -> list[DelegationOut]:
    return authority.list_delegations(user)


@router.get("/eligible-delegates", response_model=list[EligibleDelegate],
            summary="Active colleagues in operational roles who can receive delegated authority")
def eligible_delegates(user: User, authority: Authority) -> list[EligibleDelegate]:
    return authority.eligible_delegates(user)


@router.post("", response_model=DelegationOut, status_code=201,
             summary="Delegate your own approval authority for one site and selected domains")
def create_delegation(body: DelegationCreate, user: User, authority: Authority) -> DelegationOut:
    return authority.create_delegation(user, body)


@router.post("/{delegation_id}/revoke", response_model=DelegationOut, summary="Revoke a delegation")
def revoke_delegation(
    body: DelegationRevoke, user: User, authority: Authority,
    delegation_id: Annotated[str, Path(pattern=r"^[0-9a-fA-F\-]{36}$")],
) -> DelegationOut:
    return authority.revoke_delegation(user, delegation_id, body.reason)
