"""Cross-module regression tests for the five newly completed pages."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from streamlit.testing.v1 import AppTest


def open_module(name: str) -> AppTest:
    app = AppTest.from_file(PROJECT_ROOT / "app.py", default_timeout=40).run()
    app.radio[0].set_value(name).run()
    assert not app.exception
    return app


def exercise_multiselects(app: AppTest, keys: list[str]) -> None:
    for key in keys:
        widget = app.multiselect(key=key)
        if widget.options:
            widget.set_value([widget.options[0]]).run()
            assert not app.exception
            app.multiselect(key=key).set_value([]).run()
            assert not app.exception


def test_fleet_filters_selection_and_status() -> None:
    app = open_module("Fleet Overview")
    exercise_multiselects(app, ["fleet_type_filter","fleet_ops_filter","fleet_risk_filter","fleet_location_filter","fleet_voyage_filter"])
    ids = app.selectbox(key="fleet_selected").options
    app.selectbox(key="fleet_selected").set_value(ids[1]).run()
    vessel_id = app.selectbox(key="fleet_selected").value
    app.selectbox(key=f"fleet_status_{vessel_id}").set_value("At Anchorage").run()
    app.button(key=f"fleet_apply_{vessel_id}").click().run()
    row = app.session_state["fleet_vessels"].loc[lambda x: x.vessel_id == vessel_id].iloc[0]
    assert row.operational_status == "At Anchorage"
    assert app.success and not app.exception
    app.radio[0].set_value("Anomaly Detection").run()
    app.radio[0].set_value("Fleet Overview").run()
    retained = app.session_state["fleet_vessels"].loc[lambda x: x.vessel_id == vessel_id].iloc[0]
    assert retained.operational_status == "At Anchorage"


def test_maintenance_filters_actions_work_order_and_history() -> None:
    app = open_module("Predictive Maintenance")
    exercise_multiselects(app, ["maint_category_filter","maint_site_filter","maint_health_filter","maint_criticality_filter","maint_status_filter","maint_spare_filter"])
    asset = app.selectbox(key="maintenance_selected").value
    app.text_input(key=f"maint_comment_{asset}").set_value("Synthetic maintenance test").run()
    app.selectbox(key=f"maint_owner_{asset}").set_value("Chief Engineer").run()
    actions = [
        ("assign_owner", "Assigned"), ("schedule_inspection", "Inspection Scheduled"),
        ("create_work_order", "Work Order Created"), ("mark_spare_part_requested", "On Hold"),
        ("mark_maintenance_started", "In Progress"), ("mark_maintenance_completed", "Completed"),
        ("defer_with_justification", "On Hold"),
    ]
    for action, expected in actions:
        app.button(key=f"maint_{action}_{asset}").click().run()
        assert app.session_state["maintenance_assets"].loc[lambda x: x.asset_id == asset,"maintenance_status"].iloc[0] == expected
        assert not app.exception
    row = app.session_state["maintenance_assets"].loc[lambda x: x.asset_id == asset].iloc[0]
    assert row.work_order_reference == "WO-2026-0001"
    assert len(app.session_state["session_work_orders"]) == 1
    assert len(app.session_state["maintenance_action_history"]) == 7


def test_voyage_filters_simulator_and_actions() -> None:
    app = open_module("Voyage & Fuel Optimisation")
    exercise_multiselects(app, ["voy_vessel_filter","voy_status_filter","voy_depart_filter","voy_dest_filter","voy_weather_filter","voy_delay_filter"])
    voyage = app.selectbox(key="voyage_selected").value
    app.slider(key=f"voy_speed_{voyage}").set_value(13.3).run()
    app.number_input(key=f"voy_bunker_{voyage}").set_value(710.0).run()
    for action, status in [
        ("accept_recommendation","Approved"),("reject_recommendation","Rejected"),
        ("request_review","Under Review"),("save_scenario","Scenario Saved"),
        ("mark_recommendation_implemented","Implemented"),
    ]:
        app.button(key=f"voy_{action}_{voyage}").click().run()
        actual = app.session_state["voyage_plans"].loc[lambda x: x.voyage_id == voyage,"optimisation_status"].iloc[0]
        assert actual == status and not app.exception
    assert voyage in app.session_state["saved_voyage_scenarios"]
    assert len(app.session_state["voyage_action_history"]) == 5


def test_safety_filters_date_selection_and_actions() -> None:
    app = open_module("Safety Monitoring")
    exercise_multiselects(app, ["safe_type_filter","safe_severity_filter","safe_site_filter","safe_location_filter","safe_status_filter","safe_source_filter"])
    date_widget = app.date_input(key="safe_date_filter")
    latest = max(date_widget.value)
    date_widget.set_value((latest, latest)).run()
    assert not app.exception
    event = app.selectbox(key="safety_selected").value
    app.text_input(key=f"safe_comment_{event}").set_value("Synthetic safety test").run()
    app.selectbox(key=f"safe_owner_{event}").set_value("HSE Manager").run()
    for action, status in [
        ("acknowledge_event","Acknowledged"),("assign_owner","Assigned"),
        ("start_investigation","Under Review"),("add_immediate_action","In Progress"),
        ("create_corrective_action","Work Order Created"),("escalate","Escalated"),
        ("mark_action_completed","Completed"),("close_event","Closed"),
    ]:
        app.button(key=f"safe_{action}_{event}").click().run()
        actual = app.session_state["safety_records"].loc[lambda x: x.event_id == event,"status"].iloc[0]
        assert actual == status and not app.exception
    assert len(app.session_state["safety_action_history"]) == 8


def test_automation_filters_actions_and_approval_guard() -> None:
    app = open_module("Automation Centre")
    exercise_multiselects(app, ["auto_workflow_filter","auto_source_filter","auto_risk_filter","auto_level_filter","auto_owner_filter","auto_approval_filter","auto_status_filter"])
    app.selectbox(key="automation_selected").set_value("AUT-0003").run()
    task = "AUT-0003"
    app.text_input(key=f"auto_comment_{task}").set_value("Synthetic approval test").run()
    app.selectbox(key=f"auto_owner_{task}").set_value("Operations Manager").run()
    app.button(key=f"auto_request_more_information_{task}").click().run()
    app.button(key=f"auto_assign_owner_{task}").click().run()
    app.button(key=f"auto_put_on_hold_{task}").click().run()
    app.button(key=f"auto_execute_simulated_action_{task}").click().run()
    assert app.session_state["automation_tasks"].loc[lambda x:x.task_id==task,"status"].iloc[0] == "On Hold"
    assert app.error and "must be approved" in app.error[0].value
    app.button(key=f"auto_approve_{task}").click().run()
    app.button(key=f"auto_execute_simulated_action_{task}").click().run()
    assert app.session_state["automation_tasks"].loc[lambda x:x.task_id==task,"status"].iloc[0] == "Executed"
    app.button(key=f"auto_close_task_{task}").click().run()
    app.button(key=f"auto_reject_{task}").click().run()
    assert len(app.session_state["automation_approval_history"]) == 7
    assert not app.exception


if __name__ == "__main__":
    test_fleet_filters_selection_and_status()
    test_maintenance_filters_actions_work_order_and_history()
    test_voyage_filters_simulator_and_actions()
    test_safety_filters_date_selection_and_actions()
    test_automation_filters_actions_and_approval_guard()
    print("REMAINING_MODULE_TESTS_PASS")
