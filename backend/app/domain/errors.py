"""Domain errors mapped to structured HTTP responses in app.main."""


class DomainError(Exception):
    status_code = 400
    code = "domain_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(DomainError):
    status_code = 404
    code = "not_found"


class InvalidTransitionError(DomainError):
    status_code = 409
    code = "invalid_state_transition"


class HumanApprovalRequiredError(DomainError):
    status_code = 403
    code = "human_approval_required"
