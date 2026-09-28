"""Role-based authority matrix. The single source of truth for who may do what.

Principles:
- Agents propose; only humans in an accountable role may approve, reject or execute.
- Approval authority follows the operational domain (engineering, navigation, HSE).
- Administrators manage accounts but hold no operational approval authority (separation of duties).
- Safety-critical decisions follow the four-eyes principle: the requester cannot approve them.
"""

from __future__ import annotations

from app.domain.enums import AgentName, Role

APPROVER_ROLES: dict[AgentName, frozenset[Role]] = {
    AgentName.ANOMALY: frozenset({Role.CHIEF_ENGINEER, Role.TECHNICAL_SUPERINTENDENT}),
    AgentName.MAINTENANCE: frozenset({Role.CHIEF_ENGINEER, Role.TECHNICAL_SUPERINTENDENT}),
    AgentName.VOYAGE: frozenset({Role.MASTER, Role.MARINE_SUPERINTENDENT}),
    AgentName.SAFETY: frozenset({Role.HSE_MANAGER, Role.MASTER}),
}

# May request recommendations and open a review.
OPERATIONAL_ROLES: frozenset[Role] = frozenset(
    {Role.OPERATOR} | {r for roles in APPROVER_ROLES.values() for r in roles}
)

READ_ROLES: frozenset[Role] = frozenset(Role)
ADMIN_ROLES: frozenset[Role] = frozenset({Role.ADMIN})


def can_generate(role: Role) -> bool:
    return role in OPERATIONAL_ROLES


def can_review(role: Role) -> bool:
    return role in OPERATIONAL_ROLES


def can_decide(role: Role, domain: AgentName) -> bool:
    return role in APPROVER_ROLES.get(domain, frozenset())


def approver_labels(domain: AgentName) -> list[str]:
    return sorted(r.label for r in APPROVER_ROLES.get(domain, frozenset()))


def permission_summary(role: Role) -> dict:
    return {
        "can_generate": can_generate(role),
        "can_review": can_review(role),
        "approve_domains": sorted(d.value for d in APPROVER_ROLES if can_decide(role, d)),
        "can_manage_users": role in ADMIN_ROLES,
    }


def approval_matrix() -> dict[str, list[dict[str, str]]]:
    return {
        d.value: [{"role": r.value, "label": r.label} for r in sorted(roles, key=lambda x: x.value)]
        for d, roles in APPROVER_ROLES.items()
    }
