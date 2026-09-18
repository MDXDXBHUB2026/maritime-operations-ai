"""Regression coverage for Anomaly Detection filters, selection and actions."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from streamlit.testing.v1 import AppTest


def _open_module() -> AppTest:
    app = AppTest.from_file(PROJECT_ROOT / "app.py", default_timeout=30).run()
    app.radio[0].set_value("Anomaly Detection").run()
    assert not app.exception
    return app


def _row(app: AppTest, anomaly_id: str):
    data = app.session_state["anomalies"]
    return data.loc[data["anomaly_id"] == anomaly_id].iloc[0]


def test_filters_and_all_asset_categories() -> None:
    app = _open_module()
    category_filter = app.multiselect(key="anomaly_category_filter")
    for category in ["Vessel Main Engine", "Vessel Fuel Performance", "Quay Crane", "Reefer Container"]:
        category_filter.set_value([category]).run()
        assert not app.exception
        selected = app.selectbox(key="selected_anomaly_id").value
        assert _row(app, selected)["asset_category"] == category
        # Each selection renders its parameter-specific trend without an exception.
        assert app.get("plotly_chart") or app.get("unknown")
        category_filter = app.multiselect(key="anomaly_category_filter")

    app.multiselect(key="anomaly_category_filter").set_value([]).run()
    app.multiselect(key="anomaly_site_filter").set_value(["North Container Terminal"]).run()
    assert not app.exception
    app.multiselect(key="anomaly_site_filter").set_value([]).run()
    app.multiselect(key="anomaly_severity_filter").set_value(["Critical"]).run()
    assert not app.exception
    app.multiselect(key="anomaly_severity_filter").set_value(["Critical", "High", "Medium", "Low"]).run()
    app.multiselect(key="anomaly_type_filter").set_value(["Threshold breach"]).run()
    assert not app.exception
    app.multiselect(key="anomaly_type_filter").set_value([]).run()
    app.multiselect(key="anomaly_status_filter").set_value(["New"]).run()
    assert not app.exception
    date_widget = app.date_input(key="anomaly_date_filter")
    latest_date = max(date_widget.value)
    date_widget.set_value((latest_date, latest_date)).run()
    assert not app.exception


def test_all_operator_actions_and_history() -> None:
    app = _open_module()
    anomaly_id = app.selectbox(key="selected_anomaly_id").value
    app.text_input(key=f"anomaly_comment_{anomaly_id}").set_value("Synthetic operator test").run()

    app.button(key=f"anomaly_acknowledge_{anomaly_id}").click().run()
    assert _row(app, anomaly_id)["status"] == "Acknowledged"
    app.selectbox(key=f"anomaly_owner_{anomaly_id}").set_value("Chief Engineer").run()
    app.button(key=f"anomaly_assign_owner_{anomaly_id}").click().run()
    assert _row(app, anomaly_id)["owner"] == "Chief Engineer"
    app.button(key=f"anomaly_escalate_{anomaly_id}").click().run()
    assert _row(app, anomaly_id)["severity"] == "Critical"
    app.button(key=f"anomaly_continue_monitoring_{anomaly_id}").click().run()
    assert _row(app, anomaly_id)["status"] == "Monitoring"
    app.button(key=f"anomaly_initiate_inspection_{anomaly_id}").click().run()
    assert _row(app, anomaly_id)["status"] == "Inspection Initiated"
    app.button(key=f"anomaly_create_work_order_{anomaly_id}").click().run()
    assert _row(app, anomaly_id)["status"] == "Work Order Created"
    assert _row(app, anomaly_id)["work_order_reference"] == "WO-2026-0001"
    app.button(key=f"anomaly_close_anomaly_{anomaly_id}").click().run()
    assert _row(app, anomaly_id)["status"] == "Closed"
    assert app.selectbox(key="selected_anomaly_id").value == anomaly_id
    assert len(app.session_state["anomaly_action_history"]) == 7
    assert app.success and "completed" in app.success[0].value
    assert not app.exception


if __name__ == "__main__":
    test_filters_and_all_asset_categories()
    test_all_operator_actions_and_history()
    print("ANOMALY_MODULE_TESTS_PASS")
