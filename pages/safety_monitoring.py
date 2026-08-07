"""Synthetic safety monitoring and corrective-action workflow."""

from __future__ import annotations
from pathlib import Path
import pandas as pd
import plotly.express as px
import streamlit as st

from utils.safety_calculations import safety_kpis
from utils.ui_helpers import append_history, history_table, kpi_cards, load_data, page_header, show_flash

DATA=Path(__file__).resolve().parents[1]/"data"/"safety_events.csv"
OWNERS=["Unassigned","HSE Manager","Terminal Safety Lead","Marine Superintendent","Shift Supervisor","Investigation Lead"]


def _load()->pd.DataFrame:
    required={"event_id","timestamp","event_type","detection_source","vessel_or_terminal","location","severity","description","persons_exposed","immediate_action","recommended_corrective_action","responsible_owner","due_date","status","overdue_flag","risk_score","evidence_reference"}
    return load_data(DATA,required,["timestamp","due_date"])


def _action(event_id:str,action:str,status:str,comment:str="",owner:str|None=None,immediate:str|None=None,escalate:bool=False)->None:
    try:
        frame=st.session_state.safety_records; mask=frame.event_id==event_id
        if not mask.any(): raise ValueError("Safety event not found")
        previous=str(frame.loc[mask,"status"].iloc[0])
        if owner is not None: frame.loc[mask,"responsible_owner"]=owner
        if immediate: frame.loc[mask,"immediate_action"]=immediate
        if escalate: frame.loc[mask,"severity"]="Critical"; frame.loc[mask,"risk_score"]=100
        frame.loc[mask,"status"]=status
        append_history("safety_action_history",{"event":event_id,"action":action,"previous_status":previous,"new_status":status,"owner":str(frame.loc[mask,"responsible_owner"].iloc[0]),"comment":comment or "—"})
        st.session_state.safety_selected=event_id; st.session_state.safety_confirmation=f"{event_id}: {action} completed"; st.session_state.pop("safety_error",None)
    except Exception as exc: st.session_state.safety_error=f"Unable to update {event_id}. ({exc})"


def render()->None:
    try: source=_load()
    except Exception as exc: st.error(f"Safety data could not be loaded. ({exc})",icon="🚨"); return
    if "safety_records" not in st.session_state: st.session_state.safety_records=source.copy()
    st.session_state.setdefault("safety_action_history",[])
    events=st.session_state.safety_records
    page_header("SAFETY INTELLIGENCE","Safety Monitoring","Synthetic observations and simulated detection events","This conceptual safety module uses synthetic records, neutral evidence references and illustrative risk scores. It does not use real photographs, production computer vision or approved safety limits.")
    show_flash("safety"); kpi_cards(safety_kpis(events))
    cols=st.columns(6)
    values=[cols[0].multiselect("Event type",sorted(events.event_type.unique()),key="safe_type_filter"),cols[1].multiselect("Severity",["Critical","High","Medium","Low"],key="safe_severity_filter"),cols[2].multiselect("Vessel or terminal",sorted(events.vessel_or_terminal.unique()),key="safe_site_filter"),cols[3].multiselect("Location",sorted(events.location.unique()),key="safe_location_filter"),cols[4].multiselect("Status",sorted(events.status.unique()),key="safe_status_filter"),cols[5].multiselect("Detection source",sorted(events.detection_source.unique()),key="safe_source_filter")]
    min_date,max_date=events.timestamp.dt.date.min(),events.timestamp.dt.date.max()
    dates=st.date_input("Date range",(min_date,max_date),min_value=min_date,max_value=max_date,key="safe_date_filter")
    filtered=events.copy()
    for selected,field in zip(values,["event_type","severity","vessel_or_terminal","location","status","detection_source"]):
        if selected: filtered=filtered[filtered[field].isin(selected)]
    if isinstance(dates,(list,tuple)) and len(dates)==2: filtered=filtered[filtered.timestamp.dt.date.between(*dates)]
    if filtered.empty: st.info("No safety events match the selected filters."); return
    st.markdown("### Safety event register")
    st.dataframe(filtered[["event_id","timestamp","event_type","detection_source","vessel_or_terminal","location","severity","persons_exposed","risk_score","status","due_date"]],hide_index=True,width="stretch",height=330)
    c1,c2,c3=st.columns(3)
    heat=filtered.pivot_table(index="location",columns="severity",values="risk_score",aggfunc="mean",fill_value=0)
    c1.plotly_chart(px.imshow(heat,text_auto=".0f",color_continuous_scale="YlOrRd",title="Risk heat map"),width="stretch")
    trend=filtered.assign(day=filtered.timestamp.dt.date).groupby("day").size().reset_index(name="Events")
    c2.plotly_chart(px.line(trend,x="day",y="Events",markers=True,title="Event trend"),width="stretch")
    dist=filtered.groupby("event_type").size().reset_index(name="Events")
    c3.plotly_chart(px.bar(dist,x="event_type",y="Events",color="Events",title="Event distribution"),width="stretch")
    left,right=st.columns(2)
    ageing=filtered[filtered.status!="Closed"].assign(age_days=(pd.Timestamp("2026-07-23")-filtered.loc[filtered.status!="Closed","timestamp"].dt.normalize()).dt.days)
    left.markdown("### Corrective-action ageing"); left.plotly_chart(px.histogram(ageing,x="age_days",color="severity",nbins=8),width="stretch")
    high=filtered.groupby(["vessel_or_terminal","location"],as_index=False).risk_score.mean().nlargest(10,"risk_score")
    right.markdown("### High-risk locations"); right.dataframe(high,hide_index=True,width="stretch")
    camera=filtered[filtered.detection_source=="Synthetic camera event"].head(3)
    if not camera.empty:
        st.markdown("### Simulated camera-event cards")
        for col,(_,item) in zip(st.columns(3),camera.iterrows()):
            col.markdown(f"<div class='alert-card {item.severity.lower()}'><div class='alert-heading'><span class='pill {item.severity.lower()}'>{item.severity}</span><strong>{item.event_type}</strong></div><div class='alert-description'>Neutral synthetic event placeholder</div><div class='alert-grid'><div><label>LOCATION</label>{item.location}</div><div><label>EVIDENCE REFERENCE</label>{item.evidence_reference}</div><div><label>RISK</label>{item.risk_score}</div></div></div>",unsafe_allow_html=True)
    ids=filtered.event_id.tolist()
    if st.session_state.get("safety_selected") not in ids: st.session_state.safety_selected=ids[0]
    selected=st.selectbox("Select safety event",ids,format_func=lambda x:f"{x} · {filtered.loc[filtered.event_id==x,'event_type'].iloc[0]}",key="safety_selected")
    row=events.loc[events.event_id==selected].iloc[0]
    st.markdown("### Event detail")
    st.markdown(f"<div class='alert-card {row.severity.lower()}'><div class='alert-heading'><span class='pill {row.severity.lower()}'>{row.severity}</span><strong>{row.event_type}</strong><span>{row.status}</span></div><div class='anomaly-detail-grid'><div><label>DESCRIPTION</label>{row.description}</div><div><label>RISK SCORE</label>{row.risk_score}/100</div><div><label>DETECTION SOURCE</label>{row.detection_source}</div><div><label>PERSONS EXPOSED</label>{row.persons_exposed}</div><div><label>IMMEDIATE ACTION</label>{row.immediate_action}</div><div><label>CORRECTIVE ACTION</label>{row.recommended_corrective_action}</div><div><label>OWNER / DUE</label>{row.responsible_owner} · {row.due_date:%d %b %Y}</div><div><label>EVIDENCE PLACEHOLDER</label>{row.evidence_reference}</div></div></div>",unsafe_allow_html=True)
    comment=st.text_input("Optional action comment",key=f"safe_comment_{selected}")
    immediate=st.text_input("Immediate action update",value=str(row.immediate_action),key=f"safe_immediate_{selected}")
    owner=st.selectbox("Assign owner",OWNERS,index=OWNERS.index(row.responsible_owner) if row.responsible_owner in OWNERS else 0,key=f"safe_owner_{selected}")
    actions=[("Acknowledge","Acknowledge event","Acknowledged",{}),("Assign","Assign owner","Assigned",{"owner":owner}),("Investigate","Start investigation","Under Review",{}),("Immediate action","Add immediate action","In Progress",{"immediate":immediate}),("Corrective action","Create corrective action","Work Order Created",{}),("Escalate","Escalate","Escalated",{"escalate":True}),("Complete","Mark action completed","Completed",{}),("Close","Close event","Closed",{})]
    for col,(label,action,status,extra) in zip(st.columns(8),actions): col.button(label,key=f"safe_{action.lower().replace(' ','_')}_{selected}",on_click=_action,args=(selected,action,status),kwargs={"comment":comment,**extra},width="stretch")
    st.markdown("### Action history"); history_table("safety_action_history",["timestamp","event","action","previous_status","new_status","owner","comment"],["Timestamp","Event","Action","Previous","New","Owner","Comment"],"No safety actions recorded in this session.")
