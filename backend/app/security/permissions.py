"""Role-based authority matrix. The single source of truth for who may do what.

Principles:
- Agents propose; only humans in an accountable role may approve, reject or execute.
- Approval authority follows the operational domain (engineering, navigation, HSE).
- Administrators manage accounts but hold no operational approval authority (separation of duties).
- Safety-critical decisions follow the four-eyes principle: the requester cannot approve them.
- Authority is scoped to sites (vessels/terminals). Shipboard roles act only for their assigned
  vessels; shore roles are fleet-wide or limited to assigned sites. No scope means no authority.
"""

from __future__ import annotations

from typing import Iterable, Optional

from app.domain.enums import AgentName, Role, SiteType

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

# Shipboard roles hold authority only on board specific vessels.
SHIPBOARD_ROLES: frozenset[Role] = frozenset({Role.MASTER, Role.CHIEF_ENGINEER})
# Roles whose write actions are site-scoped (everyone who can act on decisions).
SCOPED_ROLES: frozenset[Role] = OPERATIONAL_ROLES
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


def default_fleet_wide(role: Role) -> bool:
    return role in SCOPED_ROLES and role not in SHIPBOARD_ROLES


def validate_scope(role: Role, fleet_wide: bool, site_types: Iterable[SiteType]) -> Optional[str]:
    """Return an error message if the scope is not allowed for the role, else None."""
    types = list(site_types)
    if role not in SCOPED_ROLES:
        if fleet_wide or types:
            return f"{role.label} accounts do not take a site scope"
        return None
    if role in SHIPBOARD_ROLES:
        if fleet_wide:
            return f"{role.label} is a shipboard role and cannot be fleet-wide"
        if not types:
            return f"{role.label} must be assigned to at least one vessel"
        if any(t != SiteType.VESSEL for t in types):
            return f"{role.label} can only be assigned to vessels, not terminals"
        return None
    if not fleet_wide and not types:
        return f"{role.label} needs fleet-wide scope or at least one assigned site"
    return None


def in_scope(fleet_wide: bool, site_ids: frozenset[str], site_id: Optional[str]) -> bool:
    """Fleet-wide users may act anywhere; others only on resolved sites they are assigned to."""
    if fleet_wide:
        return True
    return site_id is not None and site_id in site_ids
