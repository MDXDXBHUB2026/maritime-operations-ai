"""Always-available, key-free provider producing reproducible template text."""

from app.ai.provider import AIProvider, AIRequest, AIResponse


class DeterministicProvider(AIProvider):
    name = "deterministic"

    def is_available(self) -> bool:
        return True

    def complete(self, request: AIRequest) -> AIResponse:
        facts = request.facts
        if request.task == "recommendation_summary":
            headline = str(facts.get("headline", "")).strip()
            severity = facts.get("severity")
            entity = facts.get("entity_label") or facts.get("entity_id", "")
            first_action = next(iter(facts.get("actions") or []), None)
            parts = [f"[{severity}] {entity}: {headline}" if severity else f"{entity}: {headline}"]
            if first_action:
                parts.append(f"Proposed next step: {first_action}.")
            if facts.get("requires_human_approval", True):
                parts.append("Human approval is required before any action is taken.")
            else:
                parts.append("Advisory only; no operational change is proposed.")
            text = " ".join(parts)
        else:
            text = "; ".join(f"{key}={value}" for key, value in sorted(facts.items()))
        words = text.split()
        if len(words) > request.max_words:
            text = " ".join(words[: request.max_words]) + " ..."
        return AIResponse(text=text, provider=self.name, model=None)
