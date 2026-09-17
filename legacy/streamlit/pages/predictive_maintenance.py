"""Rule-based Predictive Maintenance module."""

from __future__ import annotations
from pathlib import Path
import pandas as pd
import plotly.express as px
import streamlit as st

from utils.maintenance_calculations import health_class, maintenance_kpis
from utils.ui_helpers import append_history, history_table, kpi_cards, load_data, page_header, show_flash

ROOT = Path(__file__).resolve().parents[1] / "data"
OWNERS = ["Unassigned","Fleet Technical Manager","Chief Engineer","Terminal Maintenance Lead","Reefer Operations Supervisor","Digital Operations Analyst"]


def _load() -> tuple[pd.DataFrame,pd.DataFrame,pd.DataFrame]:
    assets = load_data(ROOT/"maintenance_assets.csv", {"asset_id","asset_name","asset_category","vessel_or_terminal","location","manufacturer","running_hours","last_maintenance_date","next_planned_maintenance_date","health_score","failure_probability_percentage","remaining_useful_life_hours","criticality","predicted_failure_mode","recommended_action","spare_part_required","spare_part_availability","estimated_downtime_hours","estimated_failure_cost_usd","maintenance_status","owner","work_order_reference"}, ["last_maintenance_date","next_planned_maintenance_date"])
    assets["work_order_reference"] = assets.work_order_reference.fillna("").astype(str)
    return assets, load_data(ROOT/"work_orders.csv",{"work_order_reference","asset_id","created_date","status","owner"},["created_date"]), load_data(ROOT/"maintenance_history.csv",{"asset_id","maintenance_date","maintenance_type","finding","downtime_hours"},["maintenance_date"])


def _action(asset_id:str, action:str, status:str, comment:str="", owner:str|None=None, work_order:bool=False, spare:bool=False) -> None:
    try:
        frame=st.session_state.maintenance_assets; mask=frame.asset_id==asset_id
        if not mask.any(): raise ValueError("Asset not found")
        previous=str(frame.loc[mask,"maintenance_status"].iloc[0])
        if owner is not None: frame.loc[mask,"owner"]=owner
        if spare: frame.loc[mask,"spare_part_availability"]="Requested"
        if work_order:
            counter=st.session_state.get("maintenance_wo_counter",1); ref=f"WO-2026-{counter:04d}"
            frame.loc[mask,"work_order_reference"]=ref; st.session_state.maintenance_wo_counter=counter+1
            st.session_state.session_work_orders.append({"work_order_reference":ref,"asset_id":asset_id,"created_date":pd.Timestamp.now(),"status":"Open","owner":str(frame.loc[mask,"owner"].iloc[0])})
        frame.loc[mask,"maintenance_status"]=status
        append_history("maintenance_action_history",{"asset":asset_id,"action":action,"previous_status":previous,"new_status":status,"owner":str(frame.loc[mask,"owner"].iloc[0]),"comment":comment or "—"})
        st.session_state.maintenance_selected=asset_id; st.session_state.maintenance_confirmation=f"{asset_id}: {action} completed"; st.session_state.pop("maintenance_error",None)
    except Exception as exc: st.session_state.maintenance_error=f"Unable to update {asset_id}. ({exc})"


def render() -> None:
    try: source,work_orders,history=_load()
    except Exception as exc: st.error(f"Maintenance data could not be loaded. ({exc})",icon="🚨"); return
    if "maintenance_assets" not in st.session_state: st.session_state.maintenance_assets=source.copy()
    st.session_state.setdefault("maintenance_action_history",[]); st.session_state.setdefault("session_work_orders",[]); st.session_state.setdefault("maintenance_wo_counter",1)
    assets=st.session_state.maintenance_assets
    page_header("PREDICTIVE MAINTENANCE","Predictive Maintenance","Rule-based visibility across vessel and terminal assets","This conceptual module uses synthetic data and prototype thresholds: health below 60 is Critical, 60–79 Warning, 80–100 Healthy; failure probability above 70% and RUL below 100 hours are illustrative only.")
    show_flash("maintenance"); kpi_cards(maintenance_kpis(assets))
    cols=st.columns(6)
    selections=[
        cols[0].multiselect("Asset category",sorted(assets.asset_category.unique()),key="maint_category_filter"),
        cols[1].multiselect("Vessel or terminal",sorted(assets.vessel_or_terminal.unique()),key="maint_site_filter"),
        cols[2].multiselect("Health classification",["Healthy","Warning","Critical"],key="maint_health_filter"),
        cols[3].multiselect("Criticality",["Critical","High","Medium","Low"],key="maint_criticality_filter"),
        cols[4].multiselect("Maintenance status",sorted(assets.maintenance_status.unique()),key="maint_status_filter"),
        cols[5].multiselect("Spare availability",sorted(assets.spare_part_availability.unique()),key="maint_spare_filter")]
    filtered=assets.assign(health_class=assets.health_score.map(health_class))
    for values,field in zip(selections,["asset_category","vessel_or_terminal","health_class","criticality","maintenance_status","spare_part_availability"]):
        if values: filtered=filtered[filtered[field].isin(values)]
    if filtered.empty: st.info("No maintenance assets match the selected filters."); return
    st.markdown("### Asset-health register")
    display=filtered[["asset_id","asset_name","asset_category","vessel_or_terminal","health_score","health_class","failure_probability_percentage","remaining_useful_life_hours","criticality","maintenance_status"]]
    st.dataframe(display,hide_index=True,width="stretch",height=330)
    c1,c2,c3=st.columns(3)
    c1.plotly_chart(px.bar(filtered.nlargest(15,"failure_probability_percentage"),x="asset_name",y="failure_probability_percentage",color="criticality",title="Failure probability (%)"),width="stretch")
    c2.plotly_chart(px.bar(filtered.nsmallest(15,"remaining_useful_life_hours"),x="asset_name",y="remaining_useful_life_hours",color="health_class",title="Remaining useful life (hours)"),width="stretch")
    cost=filtered.groupby("asset_category",as_index=False).estimated_failure_cost_usd.sum()
    c3.plotly_chart(px.bar(cost,x="asset_category",y="estimated_failure_cost_usd",title="Failure-cost exposure"),width="stretch")
    due=filtered.sort_values("next_planned_maintenance_date")[["asset_name","next_planned_maintenance_date","maintenance_status","spare_part_availability"]].head(12)
    left,right=st.columns(2)
    left.markdown("### Maintenance due dates"); left.dataframe(due,hide_index=True,width="stretch")
    spare=filtered.groupby(["asset_category","spare_part_availability"]).size().reset_index(name="Assets")
    right.markdown("### Spare-parts risk"); right.plotly_chart(px.bar(spare,x="asset_category",y="Assets",color="spare_part_availability",barmode="stack"),width="stretch")
    ids=filtered.asset_id.tolist()
    if st.session_state.get("maintenance_selected") not in ids: st.session_state.maintenance_selected=ids[0]
    selected=st.selectbox("Select maintenance asset",ids,format_func=lambda x:f"{x} · {filtered.loc[filtered.asset_id==x,'asset_name'].iloc[0]}",key="maintenance_selected")
    row=assets.loc[assets.asset_id==selected].iloc[0]; ref=row.work_order_reference or "Not created"
    st.markdown("### Asset detail")
    st.markdown(f"<div class='alert-card'><div class='alert-heading'><strong>{row.asset_name}</strong><span>{row.maintenance_status}</span></div><div class='anomaly-detail-grid'><div><label>LOCATION</label>{row.vessel_or_terminal} · {row.location}</div><div><label>RUNNING HOURS</label>{row.running_hours:,}</div><div><label>HEALTH / FAILURE</label>{row.health_score}/100 · {row.failure_probability_percentage}%</div><div><label>REMAINING USEFUL LIFE</label>{row.remaining_useful_life_hours:,} h</div><div><label>PREDICTED MODE</label>{row.predicted_failure_mode}</div><div><label>RECOMMENDED ACTION</label>{row.recommended_action}</div><div><label>SPARE PART</label>{row.spare_part_required} · {row.spare_part_availability}</div><div><label>DOWNTIME / EXPOSURE</label>{row.estimated_downtime_hours} h · ${row.estimated_failure_cost_usd:,.0f}</div><div><label>WORK ORDER</label>{ref}</div><div><label>OWNER</label>{row.owner}</div></div></div>",unsafe_allow_html=True)
    asset_hist=history[history.asset_id==selected].sort_values("maintenance_date",ascending=False)
    st.markdown("### Maintenance history"); st.dataframe(asset_hist,hide_index=True,width="stretch")
    comment=st.text_input("Optional action comment or deferral justification",key=f"maint_comment_{selected}")
    owner=st.selectbox("Assign owner",OWNERS,index=OWNERS.index(row.owner) if row.owner in OWNERS else 0,key=f"maint_owner_{selected}")
    labels=[("Assign","Assign owner","Assigned",{"owner":owner}),("Schedule inspection","Schedule inspection","Inspection Scheduled",{}),("Create work order","Create work order","Work Order Created",{"work_order":True}),("Request spare","Mark spare part requested","On Hold",{"spare":True}),("Start","Mark maintenance started","In Progress",{}),("Complete","Mark maintenance completed","Completed",{}),("Defer","Defer with justification","On Hold",{})]
    for col,(label,action,status,extra) in zip(st.columns(7),labels):
        col.button(label,key=f"maint_{action.lower().replace(' ','_')}_{selected}",on_click=_action,args=(selected,action,status),kwargs={"comment":comment,**extra},width="stretch")
    st.markdown("### Session work-order register")
    combined=pd.concat([work_orders,pd.DataFrame(st.session_state.session_work_orders)],ignore_index=True) if st.session_state.session_work_orders else work_orders
    st.dataframe(combined,hide_index=True,width="stretch")
    st.markdown("### Action history")
    history_table("maintenance_action_history",["timestamp","asset","action","previous_status","new_status","owner","comment"],["Timestamp","Asset","Action","Previous","New","Owner","Comment"],"No maintenance actions recorded in this session.")
