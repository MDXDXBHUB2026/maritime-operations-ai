"""Decision endpoints: generate (agent recommendation), review, approve, reject, simulated execute, cancel."""

from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, Path, Query

from app.api.deps import get_decision_service
from app.domain.enums import AgentName, DecisionStatus
from app.domain.models import (
    ID_PATTERN,
    ApproveRequest,
    CancelRequest,
    DecisionOut,
    ExecuteRequest,
    GenerateDecisionRequest,
    RejectRequest,
    ReviewRequest,
)
from app.services.decision_service import DecisionService

router = APIRouter(prefix="/decisions", tags=["decisions"])
Service = Annotated[DecisionService, Depends(get_decision_service)]
EntityId = Annotated[str, Path(pattern=ID_PATTERN)]
DecisionId = Annotated[str, Path(pattern=r"^[0-9a-fA-F\-]{36}$")]


def _register_generate(agent: AgentName, label: str) -> None:
    def generate(service: Service, entity_id: EntityId,
                 body: Annotated[Optional[GenerateDecisionRequest], Body()] = None) -> DecisionOut:
        requested_by = (body or GenerateDecisionRequest()).requested_by
        return service.generate(agent, entity_id, requested_by)

    generate.__name__ = f"generate_{agent.value}_recommendation"
    router.add_api_route(
        f"/{agent.value}/{{entity_id}}", generate, methods=["POST"], response_model=DecisionOut, status_code=201,
        summary=f"Generate a {label} recommendation (status PROPOSED)",
    )


# Literal-prefixed generate routes are registered before /{decision_id}/... routes.
for _agent, _label in [(AgentName.ANOMALY, "anomaly"), (AgentName.MAINTENANCE, "maintenance"),
                       (AgentName.VOYAGE, "voyage"), (AgentName.SAFETY, "safety")]:
    _register_generate(_agent, _label)


@router.get("", response_model=list[DecisionOut])
def list_decisions(service: Service, status: Optional[DecisionStatus] = None, agent: Optional[AgentName] = None,
                   entity_id: Annotated[Optional[str], Query(pattern=ID_PATTERN)] = None,
                   limit: Annotated[int, Query(ge=1, le=500)] = 100,
                   offset: Annotated[int, Query(ge=0)] = 0) -> list[DecisionOut]:
    return service.list(status=status, agent=agent, entity_id=entity_id, limit=limit, offset=offset)


@router.get("/{decision_id}", response_model=DecisionOut)
def get_decision(service: Service, decision_id: DecisionId) -> DecisionOut:
    return service.get(decision_id)


@router.post("/{decision_id}/review", response_model=DecisionOut, summary="Move PROPOSED -> UNDER_REVIEW")
def review_decision(service: Service, decision_id: DecisionId, body: ReviewRequest) -> DecisionOut:
    return service.review(decision_id, body.reviewer, body.comment)


@router.post("/{decision_id}/approve", response_model=DecisionOut, summary="Human approval -> APPROVED")
def approve_decision(service: Service, decision_id: DecisionId, body: ApproveRequest) -> DecisionOut:
    return service.approve(decision_id, body.approver, body.comment)


@router.post("/{decision_id}/reject", response_model=DecisionOut, summary="Human rejection -> REJECTED")
def reject_decision(service: Service, decision_id: DecisionId, body: RejectRequest) -> DecisionOut:
    return service.reject(decision_id, body.approver, body.reason)


@router.post("/{decision_id}/execute", response_model=DecisionOut,
             summary="Simulated execution of an APPROVED decision -> EXECUTED")
def execute_decision(service: Service, decision_id: DecisionId, body: ExecuteRequest) -> DecisionOut:
    return service.execute(decision_id, body.actor)


@router.post("/{decision_id}/cancel", response_model=DecisionOut, summary="Cancel an open decision -> CANCELLED")
def cancel_decision(service: Service, decision_id: DecisionId, body: CancelRequest) -> DecisionOut:
    return service.cancel(decision_id, body.actor, body.reason)
