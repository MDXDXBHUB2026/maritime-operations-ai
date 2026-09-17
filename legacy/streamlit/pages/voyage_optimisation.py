"""Interactive synthetic voyage and fuel optimisation simulator."""

from __future__ import annotations
from pathlib import Path
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from utils.ui_helpers import append_history, history_table, kpi_cards, load_data, page_header, show_flash
from utils.voyage_calculations import scenario, voyage_kpis

DATA=Path(__file__).resolve().parents[1]/"data"/"voyage_plans.csv"


def _load()->pd.DataFrame:
    required={"voyage_id","vessel_id","vessel_name","departure_port","destination_port","departure_time","planned_eta","predicted_eta","route_distance_nm","remaining_distance_nm","planned_speed_knots","current_speed_knots","recommended_speed_knots","planned_fuel_tonnes","predicted_fuel_tonnes","bunker_price_usd_tonne","weather_risk","sea_state","wind_factor","berth_availability_time","estimated_waiting_hours","estimated_co2_tonnes","optimisation_status","origin_latitude","origin_longitude","destination_latitude","destination_longitude"}
    return load_data(DATA,required,["departure_time","planned_eta","predicted_eta","berth_availability_time"])


def _action(voyage_id:str,action:str,status:str,comment:str="",scenario_data:dict|None=None)->None:
    try:
        frame=st.session_state.voyage_plans; mask=frame.voyage_id==voyage_id
        if not mask.any(): raise ValueError("Voyage not found")
        previous=str(frame.loc[mask,"optimisation_status"].iloc[0]); frame.loc[mask,"optimisation_status"]=status
        if scenario_data is not None: st.session_state.saved_voyage_scenarios[voyage_id]=scenario_data
        append_history("voyage_action_history",{"voyage":voyage_id,"action":action,"previous_status":previous,"new_status":status,"comment":comment or "—"})
        st.session_state.voyage_selected=voyage_id; st.session_state.voyage_confirmation=f"{voyage_id}: {action} completed"; st.session_state.pop("voyage_error",None)
    except Exception as exc: st.session_state.voyage_error=f"Unable to update {voyage_id}. ({exc})"


def render()->None:
    try: source=_load()
    except Exception as exc: st.error(f"Voyage data could not be loaded. ({exc})",icon="🚨"); return
    if "voyage_plans" not in st.session_state: st.session_state.voyage_plans=source.copy()
    st.session_state.setdefault("voyage_action_history",[]); st.session_state.setdefault("saved_voyage_scenarios",{})
    voyages=st.session_state.voyage_plans
    page_header("VOYAGE INTELLIGENCE","Voyage & Fuel Optimisation","Compare plans and explore transparent synthetic scenarios","Outputs are illustrative and are not approved navigational, engineering or commercial recommendations. They use synthetic routes and simplified calculations only.")
    show_flash("voyage"); kpi_cards(voyage_kpis(voyages))
    cols=st.columns(6)
    values=[cols[0].multiselect("Vessel",sorted(voyages.vessel_name.unique()),key="voy_vessel_filter"),cols[1].multiselect("Voyage status",sorted(voyages.optimisation_status.unique()),key="voy_status_filter"),cols[2].multiselect("Departure port",sorted(voyages.departure_port.unique()),key="voy_depart_filter"),cols[3].multiselect("Destination port",sorted(voyages.destination_port.unique()),key="voy_dest_filter"),cols[4].multiselect("Weather risk",["High","Medium","Low"],key="voy_weather_filter"),cols[5].multiselect("Delay status",["Delayed","On schedule"],key="voy_delay_filter")]
    filtered=voyages.copy()
    for selected,field in zip(values[:5],["vessel_name","optimisation_status","departure_port","destination_port","weather_risk"]):
        if selected: filtered=filtered[filtered[field].isin(selected)]
    if values[5]:
        delayed=filtered.predicted_eta>filtered.planned_eta
        filtered=filtered[(delayed & ("Delayed" in values[5])) | (~delayed & ("On schedule" in values[5]))]
    if filtered.empty: st.info("No voyages match the selected filters."); return
    st.markdown("### Voyage comparison")
    table=filtered[["voyage_id","vessel_name","departure_port","destination_port","planned_eta","predicted_eta","planned_fuel_tonnes","predicted_fuel_tonnes","estimated_waiting_hours","weather_risk","optimisation_status"]]
    st.dataframe(table,hide_index=True,width="stretch",height=310)
    c1,c2,c3=st.columns(3)
    fuel=filtered.melt(id_vars=["voyage_id"],value_vars=["planned_fuel_tonnes","predicted_fuel_tonnes"],var_name="Plan",value_name="Fuel")
    c1.plotly_chart(px.bar(fuel,x="voyage_id",y="Fuel",color="Plan",barmode="group",title="Planned vs predicted fuel"),width="stretch")
    eta=filtered.assign(delay_hours=(filtered.predicted_eta-filtered.planned_eta).dt.total_seconds()/3600)
    c2.plotly_chart(px.bar(eta,x="voyage_id",y="delay_hours",color="weather_risk",title="ETA variance (hours)"),width="stretch")
    c3.plotly_chart(px.scatter(filtered,x="current_speed_knots",y="predicted_fuel_tonnes",size="remaining_distance_nm",color="weather_risk",hover_name="vessel_name",title="Speed and fuel efficiency"),width="stretch")
    left,right=st.columns([1,1])
    left.markdown("### Waiting-time exposure"); left.plotly_chart(px.bar(filtered,x="voyage_id",y="estimated_waiting_hours",color="weather_risk"),width="stretch")
    route=pd.concat([filtered[["voyage_id","departure_port","origin_latitude","origin_longitude"]].rename(columns={"departure_port":"port","origin_latitude":"lat","origin_longitude":"lon"}),filtered[["voyage_id","destination_port","destination_latitude","destination_longitude"]].rename(columns={"destination_port":"port","destination_latitude":"lat","destination_longitude":"lon"})])
    right.markdown("### Synthetic route map"); fig=px.line_map(route,lat="lat",lon="lon",color="voyage_id",hover_name="port",zoom=1.4,height=350); fig.update_layout(map_style="carto-darkmatter",margin=dict(l=0,r=0,t=0,b=0)); right.plotly_chart(fig,width="stretch")
    ids=filtered.voyage_id.tolist()
    if st.session_state.get("voyage_selected") not in ids: st.session_state.voyage_selected=ids[0]
    selected=st.selectbox("Select voyage",ids,format_func=lambda x:f"{x} · {filtered.loc[filtered.voyage_id==x,'vessel_name'].iloc[0]}",key="voyage_selected")
    row=voyages.loc[voyages.voyage_id==selected].iloc[0]
    st.markdown("### Voyage recommendation")
    st.markdown(f"<div class='alert-card'><div class='alert-heading'><strong>{row.vessel_name}: {row.departure_port} → {row.destination_port}</strong><span>{row.optimisation_status}</span></div><div class='anomaly-detail-grid'><div><label>RECOMMENDED SPEED</label>{row.recommended_speed_knots} kn</div><div><label>WEATHER / SEA STATE</label>{row.weather_risk} · {row.sea_state}</div><div><label>PLANNED / PREDICTED FUEL</label>{row.planned_fuel_tonnes} / {row.predicted_fuel_tonnes} t</div><div><label>WAITING EXPOSURE</label>{row.estimated_waiting_hours} h</div></div></div>",unsafe_allow_html=True)
    st.markdown("### Interactive scenario simulator")
    controls=st.columns(6)
    speed=controls[0].slider("Proposed speed",8.0,22.0,float(row.recommended_speed_knots),0.1,key=f"voy_speed_{selected}")
    bunker=controls[1].number_input("Bunker price",300.0,1200.0,float(row.bunker_price_usd_tonne),10.0,key=f"voy_bunker_{selected}")
    weather=controls[2].slider("Weather severity",0.8,1.5,float(row.wind_factor),0.05,key=f"voy_weather_{selected}")
    berth=controls[3].slider("Berth delay (h)",0.0,24.0,float(row.estimated_waiting_hours),0.5,key=f"voy_berth_{selected}")
    load=controls[4].slider("Load factor",0.7,1.3,1.0,0.05,key=f"voy_load_{selected}")
    efficiency=controls[5].slider("Efficiency factor",0.8,1.2,1.0,0.02,key=f"voy_eff_{selected}")
    adjusted=scenario(row,speed,bunker,weather,berth,load,efficiency)
    recommended=scenario(row,float(row.recommended_speed_knots),float(row.bunker_price_usd_tonne),float(row.wind_factor),float(row.estimated_waiting_hours),1.0,0.95)
    current=scenario(row,float(row.current_speed_knots),float(row.bunker_price_usd_tonne),float(row.wind_factor),float(row.estimated_waiting_hours),1.0,1.0)
    comparison=pd.DataFrame([{"Scenario":"Current plan",**current},{"Scenario":"AI-style recommendation",**recommended},{"Scenario":"User adjusted",**adjusted}])
    comparison["cost_difference"]=comparison.cost-current["cost"]; comparison["co2_difference"]=comparison.co2-current["co2"]
    st.dataframe(comparison[["Scenario","eta","fuel","cost","waiting","co2","cost_difference","co2_difference"]],hide_index=True,width="stretch")
    comment=st.text_input("Optional decision comment",key=f"voy_comment_{selected}")
    saved={k:(v.isoformat() if isinstance(v,pd.Timestamp) else round(v,2)) for k,v in adjusted.items()}
    actions=[("Accept","Accept recommendation","Approved",None),("Reject","Reject recommendation","Rejected",None),("Review","Request review","Under Review",None),("Save","Save scenario","Scenario Saved",saved),("Implemented","Mark recommendation implemented","Implemented",None)]
    for col,(label,action,status,data) in zip(st.columns(5),actions): col.button(label,key=f"voy_{action.lower().replace(' ','_')}_{selected}",on_click=_action,args=(selected,action,status),kwargs={"comment":comment,"scenario_data":data},width="stretch")
    st.markdown("### Action history"); history_table("voyage_action_history",["timestamp","voyage","action","previous_status","new_status","comment"],["Timestamp","Voyage","Action","Previous","New","Comment"],"No voyage actions recorded in this session.")
