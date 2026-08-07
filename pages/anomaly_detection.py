"""Functional Anomaly Detection module using synthetic rule-based indicators."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from utils.anomaly_calculations import anomaly_kpis
from utils.data_loader import load_table


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"]
OWNERS = [
    "Unassigned", "Fleet Technical Manager", "Chief Engineer",
    "Terminal Maintenance Lead", "Reefer Operations Supervisor",
    "HSE Manager", "Digital Operations Analyst",
]


def load_anomaly_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load anomaly datasets and provide clear validation errors."""
    anomalies = load_table("anomalies", {"anomaly_id","detected_timestamp","asset_category","asset_id","asset_name","location","vessel_or_terminal","parameter_name","current_value","expected_value","lower_threshold","upper_threshold","deviation_percentage","severity","anomaly_type","probable_cause","confidence_score","recommended_action","potential_consequence","owner","status","work_order_reference"}, ["detected_timestamp"])
    sensors = load_table("sensor_readings", {"anomaly_id","timestamp","parameter_name","actual_reading","expected_baseline","lower_threshold","upper_threshold","is_detection_point"}, ["timestamp"])
    sensors["is_detection_point"] = sensors["is_detection_point"].fillna(0).astype(bool)
    # Empty CSV work-order cells otherwise infer as floating point and reject references later.
    anomalies["work_order_reference"] = anomalies["work_order_reference"].fillna("").astype(str)
    required = {
        "anomaly_id", "asset_category", "asset_id", "asset_name", "severity",
        "status", "parameter_name", "detected_timestamp",
    }
    missing = required.difference(anomalies.columns)
    if missing:
        raise ValueError(f"Anomaly data is missing required fields: {', '.join(sorted(missing))}")
    return anomalies, sensors


def _record_history(anomaly_id: str, action: str, previous: str, new: str, owner: str, comment: str) -> None:
    """Append an operator action to the current browser session history."""
    st.session_state.anomaly_action_history.append({
        "timestamp": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "anomaly_id": anomaly_id, "action": action, "previous_status": previous,
        "new_status": new, "owner": owner, "comment": comment or "—",
    })


def _perform_action(
    anomaly_id: str,
    action: str,
    new_status: str,
    comment: str = "",
    owner: str | None = None,
    escalate: bool = False,
    create_work_order: bool = False,
) -> None:
    """Safely apply an anomaly action before Streamlit redraws the page."""
    try:
        anomalies = st.session_state.get("anomalies")
        if anomalies is None:
            raise RuntimeError("Anomaly data is unavailable in this session.")
        mask = anomalies["anomaly_id"] == anomaly_id
        if not mask.any():
            raise ValueError(f"Anomaly {anomaly_id} was not found.")

        previous = str(anomalies.loc[mask, "status"].iloc[0])
        current_owner = str(anomalies.loc[mask, "owner"].iloc[0])
        if owner is not None:
            anomalies.loc[mask, "owner"] = owner
            current_owner = owner
        if escalate:
            anomalies.loc[mask, "severity"] = "Critical"
        if create_work_order:
            counter = int(st.session_state.get("work_order_counter", 1))
            reference = f"WO-2026-{counter:04d}"
            anomalies.loc[mask, "work_order_reference"] = reference
            st.session_state.work_order_counter = counter + 1
        anomalies.loc[mask, "status"] = new_status

        st.session_state.selected_anomaly_id = anomaly_id
        _record_history(anomaly_id, action, previous, new_status, current_owner, comment)
        detail = f" — {reference}" if create_work_order else ""
        st.session_state.anomaly_confirmation = f"{anomaly_id}: {action} completed{detail}"
        st.session_state.pop("anomaly_update_error", None)
    except Exception as exc:
        st.session_state.anomaly_update_error = f"Unable to update {anomaly_id}. Please try again. ({exc})"
        st.session_state.pop("anomaly_confirmation", None)


def _kpi_cards(anomalies: pd.DataFrame) -> None:
    icons = ["◉", "◆", "!", "+", "✓", "%"]
    columns = st.columns(6)
    for column, (label, value), icon in zip(columns, anomaly_kpis(anomalies).items(), icons):
        with column:
            st.markdown(
                f"<div class='kpi-card'><div class='kpi-top'><span>{icon}</span><span>RULE BASED</span></div>"
                f"<div class='kpi-value'>{value}</div><div class='kpi-label'>{label}</div></div>",
                unsafe_allow_html=True,
            )


def _filter_anomalies(anomalies: pd.DataFrame) -> pd.DataFrame:
    """Render stable filters and return the matching anomaly records."""
    first = st.columns(5)
    categories = first[0].multiselect("Asset category", sorted(anomalies["asset_category"].unique()), key="anomaly_category_filter")
    sites = first[1].multiselect("Vessel or terminal", sorted(anomalies["vessel_or_terminal"].unique()), key="anomaly_site_filter")
    severities = first[2].multiselect("Severity", SEVERITY_ORDER, default=SEVERITY_ORDER, key="anomaly_severity_filter")
    types = first[3].multiselect("Anomaly type", sorted(anomalies["anomaly_type"].unique()), key="anomaly_type_filter")
    statuses = first[4].multiselect("Status", sorted(anomalies["status"].unique()), key="anomaly_status_filter")

    min_date = anomalies["detected_timestamp"].dt.date.min()
    max_date = anomalies["detected_timestamp"].dt.date.max()
    date_range = st.date_input(
        "Detected time range", value=(min_date, max_date), min_value=min_date,
        max_value=max_date, key="anomaly_date_filter",
    )
    filtered = anomalies[anomalies["severity"].isin(severities)].copy()
    if categories:
        filtered = filtered[filtered["asset_category"].isin(categories)]
    if sites:
        filtered = filtered[filtered["vessel_or_terminal"].isin(sites)]
    if types:
        filtered = filtered[filtered["anomaly_type"].isin(types)]
    if statuses:
        filtered = filtered[filtered["status"].isin(statuses)]
    if isinstance(date_range, (tuple, list)) and len(date_range) == 2:
        start, end = date_range
        filtered = filtered[filtered["detected_timestamp"].dt.date.between(start, end)]
    return filtered.sort_values("detected_timestamp", ascending=False)


def _register(filtered: pd.DataFrame) -> str | None:
    st.markdown("### Anomaly register")
    if filtered.empty:
        st.info("No anomalies match the selected filters.")
        return None
    ids = filtered["anomaly_id"].tolist()
    if st.session_state.get("selected_anomaly_id") not in ids:
        st.session_state.selected_anomaly_id = ids[0]
    selected = st.selectbox(
        "Select anomaly to review", ids,
        format_func=lambda value: f"{value} · {filtered.loc[filtered['anomaly_id'] == value, 'asset_name'].iloc[0]}",
        key="selected_anomaly_id",
    )
    register = filtered[[
        "anomaly_id", "detected_timestamp", "asset_name", "location", "parameter_name",
        "current_value", "expected_value", "deviation_percentage", "severity", "confidence_score", "status",
    ]].copy()
    register["detected_timestamp"] = register["detected_timestamp"].dt.strftime("%d %b %Y, %H:%M")
    register.columns = ["Anomaly ID", "Detection time", "Asset", "Location", "Parameter", "Current", "Expected", "Deviation %", "Severity", "Confidence %", "Status"]
    st.dataframe(register, hide_index=True, width="stretch", height=310)
    return selected


def _detail_panel(row: pd.Series) -> None:
    severity_class = str(row["severity"]).lower()
    work_order = row["work_order_reference"] if pd.notna(row["work_order_reference"]) and str(row["work_order_reference"]).strip() else "Not created"
    st.markdown("### Selected anomaly detail")
    st.markdown(
        f"<div class='alert-card {severity_class}'><div class='alert-heading'>"
        f"<span class='pill {severity_class}'>{row['severity']}</span><strong>{row['asset_name']}</strong><span>{row['status']}</span></div>"
        f"<div class='anomaly-detail-grid'>"
        f"<div><label>ASSET IDENTITY</label>{row['asset_id']}</div><div><label>CATEGORY</label>{row['asset_category']}</div>"
        f"<div><label>VESSEL / TERMINAL</label>{row['vessel_or_terminal']}</div><div><label>LOCATION</label>{row['location']}</div>"
        f"<div><label>DETECTED</label>{row['detected_timestamp'].strftime('%d %b %Y, %H:%M')}</div><div><label>PARAMETER</label>{row['parameter_name']}</div>"
        f"<div><label>CURRENT / EXPECTED</label>{row['current_value']} / {row['expected_value']}</div><div><label>ILLUSTRATIVE RANGE</label>{row['lower_threshold']} – {row['upper_threshold']}</div>"
        f"<div><label>DEVIATION</label>{row['deviation_percentage']:.1f}%</div><div><label>CONFIDENCE</label>{row['confidence_score']:.1f}%</div>"
        f"<div><label>PROBABLE CAUSE</label>{row['probable_cause']}</div><div><label>RECOMMENDED ACTION</label>{row['recommended_action']}</div>"
        f"<div><label>POTENTIAL CONSEQUENCE</label>{row['potential_consequence']}</div><div><label>OWNER</label>{row['owner']}</div>"
        f"<div><label>WORK ORDER</label>{work_order}</div><div><label>CURRENT STATUS</label>{row['status']}</div>"
        f"</div></div>", unsafe_allow_html=True,
    )


def _trend_chart(row: pd.Series, sensors: pd.DataFrame) -> None:
    st.markdown("### Sensor trend — 24 hours")
    trend = sensors[sensors["anomaly_id"] == row["anomaly_id"]].sort_values("timestamp")
    if trend.empty:
        raise ValueError("No sensor readings are available for this anomaly.")
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=trend["timestamp"], y=trend["actual_reading"], name="Actual sensor reading", line=dict(color="#25C2D8", width=3)))
    fig.add_trace(go.Scatter(x=trend["timestamp"], y=trend["expected_baseline"], name="Expected baseline", line=dict(color="#A8B7CA", dash="dash")))
    fig.add_trace(go.Scatter(x=trend["timestamp"], y=trend["upper_threshold"], name="Upper threshold", line=dict(color="#EF5B69", dash="dot")))
    fig.add_trace(go.Scatter(x=trend["timestamp"], y=trend["lower_threshold"], name="Lower threshold", line=dict(color="#F6B84B", dash="dot")))
    point = trend[trend["is_detection_point"]]
    fig.add_trace(go.Scatter(x=point["timestamp"], y=point["actual_reading"], name="Detection point", mode="markers", marker=dict(color="#FF5364", size=14, symbol="diamond")))
    fig.update_layout(
        title=f"{row['asset_name']} — {row['parameter_name']}", xaxis_title="Timestamp",
        yaxis_title=row["parameter_name"], height=410, hovermode="x unified",
        margin=dict(l=0, r=0, t=55, b=0), paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)", font_color="#D8E4F2",
        legend=dict(orientation="h", y=1.16),
    )
    fig.update_xaxes(gridcolor="#273449")
    fig.update_yaxes(gridcolor="#273449")
    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})


def _actions(row: pd.Series) -> None:
    anomaly_id = row["anomaly_id"]
    st.markdown("### Operator actions")
    comment = st.text_input("Optional action comment", key=f"anomaly_comment_{anomaly_id}", placeholder="Add operational context for the action history")
    owner = st.selectbox(
        "Assign owner", OWNERS,
        index=OWNERS.index(row["owner"]) if row["owner"] in OWNERS else 0,
        key=f"anomaly_owner_{anomaly_id}",
    )
    cols = st.columns(7)
    specs = [
        ("Acknowledge", "Acknowledge", "Acknowledged", {}),
        ("Assign owner", "Assign owner", "Assigned", {"owner": owner}),
        ("Escalate", "Escalate", "Escalated", {"escalate": True}),
        ("Monitor", "Continue monitoring", "Monitoring", {}),
        ("Inspect", "Initiate inspection", "Inspection Initiated", {}),
        ("Work order", "Create work order", "Work Order Created", {"create_work_order": True}),
        ("Close", "Close anomaly", "Closed", {}),
    ]
    for column, (label, action, status, extras) in zip(cols, specs):
        column.button(
            label, width="stretch", key=f"anomaly_{action.lower().replace(' ', '_')}_{anomaly_id}",
            on_click=_perform_action, args=(anomaly_id, action, status),
            kwargs={"comment": comment, **extras},
        )


def _history(anomaly_id: str) -> None:
    st.markdown("### Action history")
    history = pd.DataFrame(st.session_state.anomaly_action_history)
    if history.empty:
        st.caption("No operator actions recorded in this session.")
        return
    history = history[history["anomaly_id"] == anomaly_id]
    if history.empty:
        st.caption("No operator actions recorded for this anomaly.")
        return
    display = history[["timestamp", "action", "previous_status", "new_status", "owner", "comment"]].iloc[::-1]
    display.columns = ["Timestamp", "Action", "Previous status", "New status", "Owner", "Comment"]
    st.dataframe(display, hide_index=True, width="stretch")


def render() -> None:
    """Render the complete Anomaly Detection module with guarded sections."""
    try:
        source_anomalies, sensors = load_anomaly_data()
    except Exception as exc:
        st.error(f"The anomaly module data could not be loaded. Please regenerate the synthetic data. ({exc})", icon="🚨")
        return

    if "anomalies" not in st.session_state:
        st.session_state.anomalies = source_anomalies.copy()
    if "anomaly_action_history" not in st.session_state:
        st.session_state.anomaly_action_history = []
    if "work_order_counter" not in st.session_state:
        st.session_state.work_order_counter = 1
    anomalies = st.session_state.anomalies

    st.markdown("<div class='eyebrow'>RULE-BASED OPERATIONAL INTELLIGENCE</div><h1>Anomaly Detection</h1><p class='subtitle'>Review synthetic signals across vessels, quay cranes and reefer containers</p>", unsafe_allow_html=True)
    st.markdown("<div class='module-disclaimer'>This conceptual anomaly-detection prototype uses synthetic operational data and illustrative rule-based thresholds. It is not based on production systems or approved engineering limits.</div>", unsafe_allow_html=True)
    confirmation = st.session_state.get("anomaly_confirmation")
    if confirmation:
        st.success(confirmation, icon="✅")
    update_error = st.session_state.get("anomaly_update_error")
    if update_error:
        st.error(update_error, icon="🚨")
    _kpi_cards(anomalies)

    try:
        filtered = _filter_anomalies(anomalies)
        selected_id = _register(filtered)
    except Exception as exc:
        st.error(f"The anomaly filters could not be applied. Please reset the filters and try again. ({exc})", icon="🚨")
        return
    if selected_id is None:
        return
    try:
        matches = anomalies[anomalies["anomaly_id"] == selected_id]
        if matches.empty:
            raise ValueError("The selected anomaly is no longer available.")
        row = matches.iloc[0]
        _detail_panel(row)
        _trend_chart(row, sensors)
        _actions(row)
        _history(selected_id)
    except Exception as exc:
        st.error(f"The selected anomaly could not be displayed. Please choose another record. ({exc})", icon="🚨")
