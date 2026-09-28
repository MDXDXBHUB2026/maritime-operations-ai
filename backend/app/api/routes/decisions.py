"""Decision-support endpoints. Generating a decision never executes anything."""

from typing import Annotated

from fastapi import APIRouter, Body, Path, status

from app.api.deps import ContainerDep, EntityId, SessionDep
from app.domain.enums import AgentKind
from app.domain.models import (
    ApproveRequest,
    CancelRequest,
    Decision,
    ExecuteRequest,
    GenerateDecisionRequest,
    RejectRequest,
    ReviewRequest,
)

router = APIRouter(prefix="/decisions", tags=["decisions"])

DecisionId = Annotated[
    str,
    Path(pattern=r"^[0-9a-fA-F-]{36}$", description="Decision (recommendation) UUID"),
]
GenerateBody = Annotated[GenerateDecisionRequest | None, Body()]


def _generate(
    kind: AgentKind,
    entity_id: str,
    body: GenerateDecisionRequest | None,
    container: ContainerDep,
    session: SessionDep,
) -> Decision:
    requested_by = (body or GenerateDecisionRequest()).requested_by
    return container.decisions.generate(session, kind, entity_id, requested_by)


@router.post("/anomaly/{entity_id}", response_model=Decision, status_code=status.HTTP_201_CREATED)
def generate_anomaly_decision(
    entity_id: EntityId, container: ContainerDep, session: SessionDep, body: GenerateBody = None
) -> Decision:
    return _generate(AgentKind.ANOMALY, entity_id, body, container, session)


@router.post(
    "/maintenance/{entity_id}", response_model=Decision, status_code=status.HTTP_201_CREATED
)
def generate_maintenance_decision(
    entity_id: EntityId, container: ContainerDep, session: SessionDep, body: GenerateBody = None
) -> Decision:
    return _generate(AgentKind.MAINTENANCE, entity_id, body, container, session)


@router.post("/voyage/{entity_id}", response_model=Decision, status_code=status.HTTP_201_CREATED)
def generate_voyage_decision(
    entity_id: EntityId, container: ContainerDep, session: SessionDep, body: GenerateBody = None
) -> Decision:
    return _generate(AgentKind.VOYAGE, entity_id, body, container, session)


@router.post("/safety/{entity_id}", response_model=Decision, status_code=status.HTTP_201_CREATED)
def generate_safety_decision(
    entity_id: EntityId, container: ContainerDep, session: SessionDep, body: GenerateBody = None
) -> Decision:
    return _generate(AgentKind.SAFETY, entity_id, body, container, session)


@router.get("/{decision_id}", response_model=Decision)
def get_decision(decision_id: DecisionId, container: ContainerDep, session: SessionDep) -> Decision:
    return container.decisions.get(session, decision_id)


@router.post("/{decision_id}/review", response_model=Decision)
def review_decision(
    decision_id: DecisionId, body: ReviewRequest, container: ContainerDep, session: SessionDep
) -> Decision:
    return container.decisions.review(session, decision_id, body.actor, body.comment)


@router.post("/{decision_id}/approve", response_model=Decision)
def approve_decision(
    decision_id: DecisionId, body: ApproveRequest, container: ContainerDep, session: SessionDep
) -> Decision:
    return container.decisions.approve(session, decision_id, body.actor, body.comment)


@router.post("/{decision_id}/reject", response_model=Decision)
def reject_decision(
    decision_id: DecisionId, body: RejectRequest, container: ContainerDep, session: SessionDep
) -> Decision:
    return container.decisions.reject(session, decision_id, body.actor, body.reason)


@router.post("/{decision_id}/execute", response_model=Decision)
def execute_decision(
    decision_id: DecisionId, body: ExecuteRequest, container: ContainerDep, session: SessionDep
) -> Decision:
    """Simulated execution of an APPROVED decision. No operational system is modified."""
    return container.decisions.execute(session, decision_id, body.actor)


@router.post("/{decision_id}/cancel", response_model=Decision)
def cancel_decision(
    decision_id: DecisionId, body: CancelRequest, container: ContainerDep, session: SessionDep
) -> Decision:
    return container.decisions.cancel(session, decision_id, body.actor, body.reason)
