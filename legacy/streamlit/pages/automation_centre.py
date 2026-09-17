"""Controlled operational automation with human approval."""

from __future__ import annotations
from pathlib import Path
import pandas as pd
import plotly.express as px
import streamlit as st

from utils.automation_calculations import automation_kpis
from utils.ui_helpers import append_history, history_table, kpi_cards, load_data, page_header, show_flash

DATA=Path(__file__).resolve().parents[1]/"data"/"automation_tasks.csv"
OWNERS=["Unassigned","Digital Operations Analyst","Operations Manager","Fleet Technical Manager","HSE Manager","Finance Analyst"]


def _load()->pd.DataFrame:
    required={"task_id","created_timestamp","workflow_name","module_source","vessel_or_terminal","asset_or_reference","task_description","AI_recommendation","confidence_score","risk_level","human_approval_required","assigned_owner","due_date","status","automation_level","estimated_time_saved_minutes","estimated_value_usd","final_decision","decision_comment"}
    frame=load_data(DATA,required,["created_timestamp","due_date"])
    frame["final_decision"]=frame.final_decision.fillna("").astype(str); frame["decision_comment"]=frame.decision_comment.fillna("").astype(str)
    return frame


def _action(task_id:str,action:str,new_status:str,comment:str="",owner:str|None=None)->None:
    try:
        frame=st.session_state.automation_tasks; mask=frame.task_id==task_id
        if not mask.any(): raise ValueError("Automation task not found")
        row=frame.loc[mask].iloc[0]; previous=str(row.status)
        if action=="Execute simulated action":
            if row.status=="Rejected": raise ValueError("Rejected tasks cannot be executed")
            if bool(row.human_approval_required) and row.status!="Approved": raise ValueError("This task must be approved before execution")
            if row.risk_level=="High" and row.status!="Approved": raise ValueError("High-risk tasks require approval before execution")
        if owner is not None: frame.loc[mask,"assigned_owner"]=owner
        frame.loc[mask,"status"]=new_status; frame.loc[mask,"final_decision"]=action; frame.loc[mask,"decision_comment"]=comment
        append_history("automation_approval_history",{"task":task_id,"action":action,"previous_status":previous,"new_status":new_status,"owner":str(frame.loc[mask,"assigned_owner"].iloc[0]),"comment":comment or "—"})
        st.session_state.automation_selected=task_id; st.session_state.automation_confirmation=f"{task_id}: {action} completed"; st.session_state.pop("automation_error",None)
    except Exception as exc:
        st.session_state.automation_error=f"Action blocked for {task_id}: {exc}"
        st.session_state.pop("automation_confirmation",None)


def render()->None:
    try: source=_load()
    except Exception as exc: st.error(f"Automation data could not be loaded. ({exc})",icon="🚨"); return
    if "automation_tasks" not in st.session_state: st.session_state.automation_tasks=source.copy()
    st.session_state.setdefault("automation_approval_history",[])
    tasks=st.session_state.automation_tasks
    page_header("HUMAN-CONTROLLED AUTOMATION","Operational Automation Centre","Review, approve and simulate controlled workflow execution","This conceptual automation module uses synthetic tasks and recommendations. No production action, external message, document or transaction is executed.")
    show_flash("automation"); kpi_cards(automation_kpis(tasks))
    cols=st.columns(7)
    values=[cols[0].multiselect("Workflow",sorted(tasks.workflow_name.unique()),key="auto_workflow_filter"),cols[1].multiselect("Source module",sorted(tasks.module_source.unique()),key="auto_source_filter"),cols[2].multiselect("Risk level",["High","Medium","Low"],key="auto_risk_filter"),cols[3].multiselect("Automation level",sorted(tasks.automation_level.unique()),key="auto_level_filter"),cols[4].multiselect("Owner",sorted(tasks.assigned_owner.unique()),key="auto_owner_filter"),cols[5].multiselect("Approval required",[True,False],format_func=lambda x:"Yes" if x else "No",key="auto_approval_filter"),cols[6].multiselect("Status",sorted(tasks.status.unique()),key="auto_status_filter")]
    filtered=tasks.copy()
    for selected,field in zip(values,["workflow_name","module_source","risk_level","automation_level","assigned_owner","human_approval_required","status"]):
        if selected: filtered=filtered[filtered[field].isin(selected)]
    if filtered.empty: st.info("No automation tasks match the selected filters."); return
    st.markdown("### Automation task register")
    st.dataframe(filtered[["task_id","created_timestamp","workflow_name","module_source","risk_level","human_approval_required","assigned_owner","due_date","status","estimated_time_saved_minutes","estimated_value_usd"]],hide_index=True,width="stretch",height=330)
    left,right=st.columns(2)
    awaiting=filtered[filtered.status.isin(["Awaiting Approval","Under Review"])]
    left.markdown("### Tasks awaiting approval"); left.dataframe(awaiting[["task_id","workflow_name","risk_level","assigned_owner","due_date","status"]],hide_index=True,width="stretch")
    summary=filtered.groupby("workflow_name",as_index=False).agg(tasks=("task_id","count"),minutes_saved=("estimated_time_saved_minutes","sum"),value=("estimated_value_usd","sum"))
    right.markdown("### Workflow performance"); right.dataframe(summary,hide_index=True,width="stretch")
    c1,c2,c3=st.columns(3)
    c1.plotly_chart(px.bar(filtered.groupby("module_source",as_index=False).estimated_time_saved_minutes.sum(),x="module_source",y="estimated_time_saved_minutes",title="Time-saving summary"),width="stretch")
    c2.plotly_chart(px.bar(filtered.groupby("workflow_name",as_index=False).estimated_value_usd.sum().nlargest(10,"estimated_value_usd"),x="workflow_name",y="estimated_value_usd",title="Value impact"),width="stretch")
    levels=filtered.groupby("automation_level").size().reset_index(name="Tasks")
    c3.plotly_chart(px.pie(levels,names="automation_level",values="Tasks",hole=.55,title="Automation-level distribution"),width="stretch")
    ids=filtered.task_id.tolist()
    if st.session_state.get("automation_selected") not in ids: st.session_state.automation_selected=ids[0]
    selected=st.selectbox("Select automation task",ids,format_func=lambda x:f"{x} · {filtered.loc[filtered.task_id==x,'workflow_name'].iloc[0]}",key="automation_selected")
    row=tasks.loc[tasks.task_id==selected].iloc[0]
    if row.risk_level=="High": st.warning("High-risk task: approval is mandatory before simulated execution.",icon="⚠️")
    st.markdown("### Task detail")
    st.markdown(f"<div class='alert-card {row.risk_level.lower()}'><div class='alert-heading'><span class='pill {row.risk_level.lower()}'>{row.risk_level}</span><strong>{row.workflow_name}</strong><span>{row.status}</span></div><div class='anomaly-detail-grid'><div><label>SOURCE MODULE</label>{row.module_source}</div><div><label>TASK</label>{row.task_description}</div><div><label>AI-STYLE RECOMMENDATION</label>{row.AI_recommendation}</div><div><label>CONFIDENCE</label>{row.confidence_score}%</div><div><label>APPROVAL REQUIRED</label>{'Yes' if row.human_approval_required else 'No'}</div><div><label>OWNER / DUE</label>{row.assigned_owner} · {row.due_date:%d %b %Y}</div><div><label>TIME SAVED</label>{row.estimated_time_saved_minutes} minutes</div><div><label>ESTIMATED VALUE</label>${row.estimated_value_usd:,.0f}</div></div></div>",unsafe_allow_html=True)
    st.markdown("### Controlled process flow")
    flow="Created → Under Review → Approved → Executed → Closed" if row.status!="Rejected" else "Created → Under Review → Rejected"
    st.markdown(f"<div class='process-flow'>{flow}</div>",unsafe_allow_html=True)
    comment=st.text_input("Decision comment",key=f"auto_comment_{selected}")
    owner=st.selectbox("Assign owner",OWNERS,index=OWNERS.index(row.assigned_owner) if row.assigned_owner in OWNERS else 0,key=f"auto_owner_{selected}")
    actions=[("Approve","Approve","Approved",{}),("Reject","Reject","Rejected",{}),("More info","Request more information","Under Review",{}),("Assign","Assign owner","Assigned",{"owner":owner}),("Execute","Execute simulated action","Executed",{}),("Hold","Put on hold","On Hold",{}),("Close","Close task","Closed",{})]
    for col,(label,action,status,extra) in zip(st.columns(7),actions): col.button(label,key=f"auto_{action.lower().replace(' ','_')}_{selected}",on_click=_action,args=(selected,action,status),kwargs={"comment":comment,**extra},width="stretch")
    st.markdown("### Approval history"); history_table("automation_approval_history",["timestamp","task","action","previous_status","new_status","owner","comment"],["Timestamp","Task","Action","Previous","New","Owner","Comment"],"No automation decisions recorded in this session.")
