"""Fleet Overview module for synthetic vessel operations."""

from __future__ import annotations
from pathlib import Path
import pandas as pd
import plotly.express as px
import streamlit as st

from utils.fleet_calculations import fleet_kpis, health_band
from utils.ui_helpers import kpi_cards, load_data, page_header, show_flash

DATA = Path(__file__).resolve().parents[1] / "data" / "vessels.csv"
STATUSES = ["Underway", "In Port", "At Anchorage", "Delayed", "Under Maintenance", "Off-Hire"]


def _load() -> pd.DataFrame:
    required = {"vessel_id","vessel_name","vessel_type","imo_identifier","operational_status","current_location","departure_port","destination_port","latitude","longitude","speed_knots","draft_metres","engine_load_percentage","fuel_consumption_tonnes_day","technical_health_score","open_anomalies","overdue_work_orders","safety_risk_level","planned_eta","predicted_eta","voyage_status"}
    return load_data(DATA, required, ["planned_eta", "predicted_eta"])


def _update_status(vessel_id: str, status: str) -> None:
    try:
        frame = st.session_state.fleet_vessels
        mask = frame["vessel_id"] == vessel_id
        if not mask.any(): raise ValueError("Selected vessel was not found")
        frame.loc[mask, "operational_status"] = status
        st.session_state.fleet_selected = vessel_id
        st.session_state.fleet_confirmation = f"{vessel_id} operational status updated to {status}"
        st.session_state.pop("fleet_error", None)
    except Exception as exc:
        st.session_state.fleet_error = f"Unable to update vessel status. ({exc})"


def render() -> None:
    try:
        source = _load()
    except Exception as exc:
        st.error(f"Fleet data could not be loaded. ({exc})", icon="🚨"); return
    if "fleet_vessels" not in st.session_state: st.session_state.fleet_vessels = source.copy()
    vessels = st.session_state.fleet_vessels
    page_header("FLEET OPERATIONS", "Fleet Overview", "Operational and technical visibility across the synthetic fleet", "This conceptual fleet prototype uses synthetic data and illustrative indicators. It is not based on production systems or approved operating limits.")
    show_flash("fleet"); kpi_cards(fleet_kpis(vessels))
    try:
        cols = st.columns(5)
        types = cols[0].multiselect("Vessel type", sorted(vessels.vessel_type.unique()), key="fleet_type_filter")
        ops = cols[1].multiselect("Operational status", sorted(vessels.operational_status.unique()), key="fleet_ops_filter")
        risks = cols[2].multiselect("Risk level", ["Critical","High","Medium","Low"], key="fleet_risk_filter")
        locs = cols[3].multiselect("Current location", sorted(vessels.current_location.unique()), key="fleet_location_filter")
        voyage = cols[4].multiselect("Voyage status", sorted(vessels.voyage_status.unique()), key="fleet_voyage_filter")
        filtered = vessels.copy()
        for values, field in [(types,"vessel_type"),(ops,"operational_status"),(risks,"safety_risk_level"),(locs,"current_location"),(voyage,"voyage_status")]:
            if values: filtered = filtered[filtered[field].isin(values)]
    except Exception as exc:
        st.error(f"Fleet filters could not be applied. ({exc})", icon="🚨"); return
    if filtered.empty:
        st.info("No vessels match the selected filters."); return
    left, right = st.columns([1,1.25])
    with left:
        st.markdown("### Vessel locations")
        fig = px.scatter_map(filtered, lat="latitude", lon="longitude", hover_name="vessel_name", color="safety_risk_level", color_discrete_map={"Low":"#28c499","Medium":"#f6b84b","High":"#f08b50","Critical":"#ef5b69"}, zoom=2, height=410)
        fig.update_layout(map_style="carto-darkmatter", margin=dict(l=0,r=0,t=0,b=0))
        st.plotly_chart(fig, width="stretch", config={"displayModeBar":False})
    with right:
        st.markdown("### Fleet status")
        table = filtered[["vessel_name","vessel_type","operational_status","current_location","destination_port","speed_knots","technical_health_score","open_anomalies","safety_risk_level"]].copy()
        table.columns = ["Vessel","Type","Status","Location","Destination","Speed kn","Health","Anomalies","Risk"]
        st.dataframe(table, hide_index=True, width="stretch", height=410)
    c1,c2,c3,c4 = st.columns(4)
    health = filtered.assign(health_band=filtered.technical_health_score.map(health_band)).groupby("health_band").size().reindex(["Healthy","Warning","Critical"],fill_value=0).reset_index(name="Assets")
    c1.plotly_chart(px.bar(health,x="health_band",y="Assets",color="health_band",color_discrete_map={"Healthy":"#28c499","Warning":"#f6b84b","Critical":"#ef5b69"},title="Vessel health"),width="stretch")
    delays = filtered.assign(delay_hours=((filtered.predicted_eta-filtered.planned_eta).dt.total_seconds()/3600))
    c2.plotly_chart(px.bar(delays,x="vessel_name",y="delay_hours",title="Voyage delay (hours)",color="delay_hours",color_continuous_scale="RdYlGn_r"),width="stretch")
    c3.plotly_chart(px.bar(filtered,x="vessel_name",y="fuel_consumption_tonnes_day",color="fuel_performance_status",title="Fuel performance"),width="stretch")
    exposure = filtered.melt(id_vars="vessel_name",value_vars=["open_anomalies","overdue_work_orders"],var_name="Exposure",value_name="Count")
    c4.plotly_chart(px.bar(exposure,x="vessel_name",y="Count",color="Exposure",barmode="stack",title="Technical exposure"),width="stretch")
    ids = filtered.vessel_id.tolist()
    if st.session_state.get("fleet_selected") not in ids: st.session_state.fleet_selected = ids[0]
    selected = st.selectbox("Select vessel", ids, format_func=lambda x:f"{x} · {filtered.loc[filtered.vessel_id==x,'vessel_name'].iloc[0]}", key="fleet_selected")
    row = vessels.loc[vessels.vessel_id==selected].iloc[0]
    st.markdown("### Vessel detail")
    st.markdown(f"<div class='alert-card'><div class='alert-heading'><strong>{row.vessel_name}</strong><span>{row.operational_status}</span></div><div class='anomaly-detail-grid'><div><label>IDENTITY</label>{row.imo_identifier} · {row.vessel_type}</div><div><label>CURRENT VOYAGE</label>{row.departure_port} → {row.destination_port}</div><div><label>TECHNICAL HEALTH</label>{row.technical_health_score}/100 ({health_band(row.technical_health_score)})</div><div><label>ACTIVE ANOMALIES</label>{row.open_anomalies}</div><div><label>MAINTENANCE EXPOSURE</label>{row.overdue_work_orders} overdue work orders</div><div><label>FUEL PERFORMANCE</label>{row.fuel_performance_status} · {row.fuel_consumption_tonnes_day} t/day</div><div><label>SAFETY RISK</label>{row.safety_risk_level}</div><div><label>PLANNED / PREDICTED ETA</label>{row.planned_eta:%d %b %H:%M} / {row.predicted_eta:%d %b %H:%M}</div></div></div>",unsafe_allow_html=True)
    status = st.selectbox("Update operational status", STATUSES, index=STATUSES.index(row.operational_status) if row.operational_status in STATUSES else 0, key=f"fleet_status_{selected}")
    st.button("Apply vessel status", key=f"fleet_apply_{selected}", on_click=_update_status, args=(selected,status))
