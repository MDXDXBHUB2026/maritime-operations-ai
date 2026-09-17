"""Executive Dashboard page for the synthetic maritime control tower."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from utils.calculations import dashboard_kpis, equipment_health_counts, maintenance_summary
from utils.data_loader import load_table


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"]


def load_data() -> tuple[pd.DataFrame, ...]:
    """Load the generated CSV datasets and parse dates."""
    vessels = load_table("vessels", {"vessel_name","vessel_type","operational_status","current_location","destination","predicted_eta","fuel_performance_status","risk_level","latitude","longitude"})
    voyages = load_table("voyages", {"voyage_id","vessel_name","planned_fuel_tonnes","actual_fuel_tonnes","planned_eta","predicted_eta","potential_fuel_saving_pct"}, ["planned_eta","predicted_eta"])
    equipment = load_table("equipment", {"asset_name","terminal","health_score","predicted_failure_days","maintenance_due_days","maintenance_status"})
    alerts = load_table("alerts", {"alert_id","severity","module","asset","description","probable_cause","recommended_action","owner","status","created_at"}, ["created_at"])
    safety = load_table("safety_events", {"risk_level","event_type","location","status","owner","event_date"}, ["event_date"])
    vessels["predicted_eta"] = pd.to_datetime(vessels["predicted_eta"], errors="coerce")
    return vessels, voyages, equipment, alerts, safety


def _metric_cards(kpis: dict[str, str | int]) -> None:
    cols = st.columns(6)
    icons = ["◉", "!", "⚙", "◷", "↘", "◆"]
    for col, (label, value), icon in zip(cols, kpis.items(), icons):
        with col:
            st.markdown(
                f"<div class='kpi-card'><div class='kpi-top'><span>{icon}</span><span>LIVE</span></div>"
                f"<div class='kpi-value'>{value}</div><div class='kpi-label'>{label}</div></div>",
                unsafe_allow_html=True,
            )


def _fleet_section(vessels: pd.DataFrame) -> None:
    st.markdown("### Fleet status")
    display = vessels[["vessel_name", "vessel_type", "operational_status", "current_location", "destination", "predicted_eta", "fuel_performance_status", "risk_level"]].copy()
    display["predicted_eta"] = display["predicted_eta"].dt.strftime("%d %b, %H:%M")
    display.columns = ["Vessel", "Type", "Status", "Location", "Destination", "Predicted ETA", "Fuel performance", "Risk"]
    st.dataframe(display, hide_index=True, width="stretch", height=388)


def _map_section(vessels: pd.DataFrame) -> None:
    st.markdown("### Live operational picture")
    colors = {"Low": "#28c499", "Medium": "#f6b84b", "High": "#ef5b69"}
    fig = px.scatter_map(
        vessels, lat="latitude", lon="longitude", hover_name="vessel_name",
        hover_data={"current_location": True, "destination": True, "operational_status": True, "latitude": False, "longitude": False},
        color="risk_level", color_discrete_map=colors, zoom=2.1, height=430,
    )
    fig.update_traces(marker={"size": 13})
    fig.update_layout(map_style="carto-darkmatter", margin=dict(l=0, r=0, t=0, b=0), legend_title_text="Risk")
    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})


def _alert_controls(alerts: pd.DataFrame) -> None:
    st.markdown("### Critical alert centre")

    # Display the confirmation after rerun so it remains visible on the updated UI.
    confirmation = st.session_state.get("alert_update_confirmation")
    if confirmation:
        st.success(confirmation, icon="✅")
    update_error = st.session_state.get("alert_update_error")
    if update_error:
        st.error(update_error, icon="🚨")

    f1, f2, f3, f4 = st.columns(4)
    severity = f1.multiselect("Severity", SEVERITY_ORDER, default=SEVERITY_ORDER, key="severity_filter")
    modules = f2.multiselect("Module", sorted(alerts["module"].unique()), placeholder="All modules", key="module_filter")
    assets = f3.multiselect("Asset", sorted(alerts["asset"].unique()), placeholder="All assets", key="asset_filter")
    statuses = f4.multiselect("Status", sorted(alerts["status"].unique()), placeholder="All statuses", key="status_filter")
    filtered = alerts[alerts["severity"].isin(severity)]
    if modules:
        filtered = filtered[filtered["module"].isin(modules)]
    if assets:
        filtered = filtered[filtered["asset"].isin(assets)]
    if statuses:
        filtered = filtered[filtered["status"].isin(statuses)]

    if filtered.empty:
        st.info("No alerts match the selected filters.")
        return

    available_alerts = filtered["alert_id"].tolist()
    # Streamlit requires the stored selectbox value to exist in the current options.
    # Keep the current alert across reruns whenever it still matches the filters.
    if st.session_state.get("selected_alert_id") not in available_alerts:
        st.session_state.selected_alert_id = available_alerts[0]
    selected_id = st.selectbox(
        "Select alert to inspect or update",
        available_alerts,
        format_func=lambda x: f"{x} · {filtered.loc[filtered['alert_id'] == x, 'asset'].iloc[0]}",
        key="selected_alert_id",
    )
    row = filtered.loc[filtered["alert_id"] == selected_id].iloc[0]
    severity_class = row["severity"].lower()
    st.markdown(
        f"<div class='alert-card {severity_class}'><div class='alert-heading'><span class='pill {severity_class}'>{row['severity']}</span>"
        f"<strong>{row['asset']}</strong><span>{row['status']}</span></div>"
        f"<div class='alert-description'>{row['description']}</div>"
        f"<div class='alert-grid'><div><label>PROBABLE CAUSE</label>{row['probable_cause']}</div>"
        f"<div><label>RECOMMENDED ACTION</label>{row['recommended_action']}</div>"
        f"<div><label>OWNER</label>{row['owner']}</div></div></div>", unsafe_allow_html=True,
    )

    owner_options = ["Unassigned", "Maintenance Lead", "Safety Manager", "Fleet Performance", "Voyage Manager", "Shift Supervisor", "IT Operations"]
    c1, c2, c3, c4, c5, c6 = st.columns([1, 1.4, 1, 1, 1, 1])
    c1.button(
        "Acknowledge", width="stretch", key=f"acknowledge_{selected_id}",
        on_click=_update_alert, args=(selected_id,), kwargs={"status": "Acknowledged"},
    )
    current_owner = row["owner"] if row["owner"] in owner_options else "Unassigned"
    chosen_owner = c2.selectbox(
        "Assign owner",
        owner_options,
        index=owner_options.index(current_owner),
        label_visibility="collapsed",
        key=f"owner_{selected_id}",
    )
    c3.button(
        "Assign", width="stretch", key=f"assign_{selected_id}",
        on_click=_update_alert, args=(selected_id,), kwargs={"owner": chosen_owner},
    )
    c4.button(
        "Escalate", width="stretch", key=f"escalate_{selected_id}",
        on_click=_update_alert, args=(selected_id,), kwargs={"severity": "Critical"},
    )
    c5.button(
        "Under review", width="stretch", key=f"under_review_{selected_id}",
        on_click=_update_alert, args=(selected_id,), kwargs={"status": "Under Review"},
    )
    c6.button(
        "Close", width="stretch", key=f"close_{selected_id}",
        on_click=_update_alert, args=(selected_id,), kwargs={"status": "Closed"},
    )

    table = filtered[["severity", "asset", "description", "probable_cause", "recommended_action", "owner", "status"]].copy()
    table.columns = ["Severity", "Asset", "Description", "Probable cause", "Recommended action", "Owner", "Status"]
    st.dataframe(table, hide_index=True, width="stretch", height=255)


def _update_alert(alert_id: str, **changes: str) -> None:
    """Update alert state safely before Streamlit's automatic button rerun."""
    try:
        if "alerts" not in st.session_state:
            raise RuntimeError("Alert data is not available in this session.")

        alerts = st.session_state.alerts
        mask = alerts["alert_id"] == alert_id
        if not mask.any():
            raise ValueError(f"Alert {alert_id} could not be found.")

        invalid_fields = set(changes).difference(alerts.columns)
        if invalid_fields:
            raise ValueError("The requested alert update contains an unsupported field.")

        for field, value in changes.items():
            alerts.loc[mask, field] = value

        # Explicitly retain the selection and pass the message through the rerun.
        st.session_state.selected_alert_id = alert_id
        st.session_state.alert_update_confirmation = f"{alert_id} updated successfully"
        st.session_state.pop("alert_update_error", None)
    except Exception as exc:
        # Avoid exposing an implementation traceback in the application interface.
        st.session_state.alert_update_error = f"Unable to update {alert_id}. Please try again. ({exc})"
        st.session_state.pop("alert_update_confirmation", None)


def _health_chart(equipment: pd.DataFrame) -> None:
    st.markdown("### Equipment health")
    counts = equipment_health_counts(equipment)
    fig = go.Figure(go.Pie(
        labels=list(counts), values=list(counts.values()), hole=0.68,
        marker_colors=["#28c499", "#f6b84b", "#ef5b69"], textinfo="label+value",
    ))
    fig.add_annotation(text=f"<b>{len(equipment)}</b><br>ASSETS", showarrow=False, font=dict(size=17, color="#dbe7f5"))
    fig.update_layout(height=310, margin=dict(l=5, r=5, t=10, b=10), showlegend=False, paper_bgcolor="rgba(0,0,0,0)", font_color="#dbe7f5")
    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})
    st.caption("Health rules: Healthy 80–100 · Warning 60–79 · Critical below 60")


def _voyage_section(voyages: pd.DataFrame) -> None:
    st.markdown("### Voyage performance")
    chart = voyages.melt(id_vars=["voyage_id", "vessel_name"], value_vars=["planned_fuel_tonnes", "actual_fuel_tonnes"], var_name="Measure", value_name="Fuel (t)")
    chart["Measure"] = chart["Measure"].map({"planned_fuel_tonnes": "Planned", "actual_fuel_tonnes": "Actual"})
    fig = px.bar(chart, x="voyage_id", y="Fuel (t)", color="Measure", barmode="group", color_discrete_map={"Planned": "#4472e8", "Actual": "#21b6a8"}, hover_data=["vessel_name"], height=315)
    fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), legend_orientation="h", legend_y=1.1, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font_color="#c9d7e8")
    fig.update_xaxes(gridcolor="#273449")
    fig.update_yaxes(gridcolor="#273449")
    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})
    eta = voyages[["voyage_id", "vessel_name", "planned_eta", "predicted_eta"]].copy()
    eta["variance_hours"] = ((eta["predicted_eta"] - eta["planned_eta"]).dt.total_seconds() / 3600).astype(int)
    eta["planned_eta"] = eta["planned_eta"].dt.strftime("%d %b, %H:%M")
    eta["predicted_eta"] = eta["predicted_eta"].dt.strftime("%d %b, %H:%M")
    eta.columns = ["Voyage", "Vessel", "Planned ETA", "Predicted ETA", "Variance (h)"]
    st.dataframe(eta, hide_index=True, width="stretch")


def _summaries(equipment: pd.DataFrame, safety: pd.DataFrame) -> None:
    left, right = st.columns(2)
    with left:
        st.markdown("### Maintenance overview")
        summary = maintenance_summary(equipment)
        for label, value in summary.items():
            st.markdown(f"<div class='summary-row'><span>{label}</span><strong>{value}</strong></div>", unsafe_allow_html=True)
        upcoming = equipment.nsmallest(5, "maintenance_due_days")[["asset_name", "terminal", "maintenance_due_days", "maintenance_status"]]
        upcoming.columns = ["Asset", "Terminal", "Due (days)", "Status"]
        st.dataframe(upcoming, hide_index=True, width="stretch")
    with right:
        st.markdown("### Safety overview")
        open_items = safety[safety["status"] != "Closed"]
        metrics = {"Open observations": len(open_items), "High risk": int((open_items["risk_level"] == "High").sum()), "Closed this period": int((safety["status"] == "Closed").sum())}
        for label, value in metrics.items():
            st.markdown(f"<div class='summary-row'><span>{label}</span><strong>{value}</strong></div>", unsafe_allow_html=True)
        recent = safety.sort_values("event_date", ascending=False)[["risk_level", "event_type", "location", "status"]]
        recent.columns = ["Risk", "Observation", "Location", "Status"]
        st.dataframe(recent, hide_index=True, width="stretch")


def render() -> None:
    vessels, voyages, equipment, source_alerts, safety = load_data()
    if "alerts" not in st.session_state:
        st.session_state.alerts = source_alerts.copy()
    alerts = st.session_state.alerts

    st.markdown("<div class='eyebrow'>EXECUTIVE OPERATIONS DASHBOARD</div><h1>Maritime Operations Control Tower</h1><p class='subtitle'>Unified situational awareness across fleet, terminals, equipment and safety</p>", unsafe_allow_html=True)
    _metric_cards(dashboard_kpis(vessels, voyages, equipment, alerts, safety))
    st.markdown("<div class='section-gap'></div>", unsafe_allow_html=True)
    map_col, fleet_col = st.columns([1.05, 1.35])
    with map_col:
        _map_section(vessels)
    with fleet_col:
        _fleet_section(vessels)
    _alert_controls(alerts)
    health_col, voyage_col = st.columns([0.75, 1.6])
    with health_col:
        _health_chart(equipment)
    with voyage_col:
        _voyage_section(voyages)
    _summaries(equipment, safety)
