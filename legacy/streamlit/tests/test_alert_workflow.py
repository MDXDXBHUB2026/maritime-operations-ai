"""Regression test for the session-based executive alert workflow."""

from pathlib import Path
import sys

# Make project packages importable when this file is run directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from streamlit.testing.v1 import AppTest


def _alert_row(app: AppTest, alert_id: str):
    alerts = app.session_state["alerts"]
    return alerts.loc[alerts["alert_id"] == alert_id].iloc[0]


def _assert_stable_ui(app: AppTest) -> None:
    assert not app.exception
    assert app.selectbox(key="selected_alert_id").value == "ALT-001"
    assert app.multiselect(key="module_filter").value == ["Predictive Maintenance"]
    assert app.success
    assert "updated successfully" in app.success[0].value


def test_all_alert_actions_preserve_state() -> None:
    app = AppTest.from_file(PROJECT_ROOT / "app.py", default_timeout=30).run()
    app.multiselect(key="module_filter").set_value(["Predictive Maintenance"]).run()

    app.button(key="acknowledge_ALT-001").click().run()
    _assert_stable_ui(app)
    assert _alert_row(app, "ALT-001")["status"] == "Acknowledged"

    app.selectbox(key="owner_ALT-001").set_value("Safety Manager").run()
    app.button(key="assign_ALT-001").click().run()
    _assert_stable_ui(app)
    assert _alert_row(app, "ALT-001")["owner"] == "Safety Manager"

    app.button(key="escalate_ALT-001").click().run()
    _assert_stable_ui(app)
    assert _alert_row(app, "ALT-001")["severity"] == "Critical"

    app.button(key="under_review_ALT-001").click().run()
    _assert_stable_ui(app)
    assert _alert_row(app, "ALT-001")["status"] == "Under Review"

    app.button(key="close_ALT-001").click().run()
    _assert_stable_ui(app)
    assert _alert_row(app, "ALT-001")["status"] == "Closed"


if __name__ == "__main__":
    test_all_alert_actions_preserve_state()
    print("ALL_ALERT_ACTIONS_PASS")
