"""Crew rotation: who holds shipboard authority on each vessel, and scheduled handovers."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.api.deps import get_authority_service, get_current_principal
from app.domain.models import ID_PATTERN, CrewOut, HandoverRequest, Principal
from app.services.authority_service import AuthorityService

router = APIRouter(tags=["crew"])
User = Annotated[Principal, Depends(get_current_principal)]
Authority = Annotated[AuthorityService, Depends(get_authority_service)]
SiteId = Annotated[str, Path(pattern=ID_PATTERN)]


@router.get("/crew", response_model=list[CrewOut], summary="Current and scheduled assignments for every site")
def crew_all(_: User, authority: Authority) -> list[CrewOut]:
    return authority.crew_all()


@router.get("/sites/{site_id}/crew", response_model=CrewOut, summary="Current and scheduled assignments for a site")
def crew(site_id: SiteId, _: User, authority: Authority) -> CrewOut:
    return authority.crew(site_id)


@router.post("/sites/{site_id}/handover", response_model=CrewOut,
             summary="Administrator: hand over Master / Chief Engineer duties now or at a scheduled time")
def handover(site_id: SiteId, body: HandoverRequest, user: User, authority: Authority) -> CrewOut:
    return authority.handover(user, site_id, body)
