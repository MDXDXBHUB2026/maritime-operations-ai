"""Entry point for the Maritime AI Operations Control Tower prototype."""

from pathlib import Path

import streamlit as st
st.set_option("client.toolbarMode", "minimal")
from pages.executive_dashboard import render as render_executive_dashboard
from pages.anomaly_detection import render as render_anomaly_detection
from pages.fleet_overview import render as render_fleet_overview
from pages.predictive_maintenance import render as render_predictive_maintenance
from pages.voyage_optimisation import render as render_voyage_optimisation
from pages.safety_monitoring import render as render_safety_monitoring
from pages.automation_centre import render as render_automation_centre
from utils.anomaly_generator import generate_anomaly_data
from utils.maintenance_generator import generate_maintenance_data
from utils.voyage_generator import generate_voyage_data
from utils.safety_generator import generate_safety_data
from utils.automation_generator import generate_automation_data
from database import initialise_database
from utils.data_generator import generate_data


st.set_page_config(page_title="Maritime AI Control Tower", page_icon="⚓", layout="wide", initial_sidebar_state="expanded")

# Generate deterministic synthetic inputs on first run if they are absent.
data_dir = Path(__file__).parent / "data"
required_files = ["vessels.csv", "voyages.csv", "equipment.csv", "alerts.csv", "safety_events.csv"]
if not all((data_dir / name).exists() for name in required_files):
    generate_data(data_dir)
anomaly_files = ["anomalies.csv", "sensor_readings.csv"]
if not all((data_dir / name).exists() for name in anomaly_files):
    generate_anomaly_data(data_dir)
module_data = {
    ("maintenance_assets.csv", "work_orders.csv", "maintenance_history.csv"): generate_maintenance_data,
    ("voyage_plans.csv", "fuel_performance.csv", "weather_routes.csv"): generate_voyage_data,
    ("safety_events.csv", "safety_observations.csv", "corrective_actions.csv"): generate_safety_data,
    ("automation_workflows.csv", "automation_tasks.csv", "approval_history.csv"): generate_automation_data,
}
for filenames, generator in module_data.items():
    if not all((data_dir / name).exists() for name in filenames):
        generator(data_dir)
try:
    initialise_database()
except Exception as exc:
    st.error(
        f"The operational database could not be initialised. "
        f"Please run python scripts/initialise_database.py and try again. ({exc})",
        icon="🚨",
    )
    st.stop()

st.markdown("""
<style>
    :root { --navy:#07111f; --panel:#101d2f; --line:#24334a; --text:#e8f0fa; --muted:#93a6bd; --cyan:#23b9c3; }
    .stApp { background: radial-gradient(circle at 70% 0%, #13273d 0%, #07111f 36%, #060d18 100%); color:var(--text); }
    [data-testid="stSidebar"] { background:#07111f; border-right:1px solid #1c2c42; color:#E6EEF8; }
    [data-testid="stSidebar"] h1,
    [data-testid="stSidebar"] h2,
    [data-testid="stSidebar"] h3,
    [data-testid="stSidebar"] p,
    [data-testid="stSidebar"] span,
    [data-testid="stSidebar"] label,
    [data-testid="stSidebar"] a,
    [data-testid="stSidebar"] button { color:#E6EEF8!important; }
    [data-testid="stSidebar"] [data-testid="stCaptionContainer"] p { color:#9FB3C8!important; opacity:1; }
    [data-testid="stSidebar"] .stRadio label {
        padding:.55rem .7rem; border-radius:7px; color:#E6EEF8!important;
        transition:background-color .15s ease, color .15s ease;
    }
    [data-testid="stSidebar"] .stRadio label:hover { background:#102B45; color:#FFFFFF!important; }
    [data-testid="stSidebar"] .stRadio label:has(input:checked) { background:#17324D; color:#FFFFFF!important; }
    [data-testid="stSidebar"] .stRadio label:has(input:checked) p,
    [data-testid="stSidebar"] .stRadio label:hover p { color:#FFFFFF!important; }
    [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] hr { border-color:#29415B; }
    [data-testid="stSidebar"] button:hover,
    [data-testid="stSidebar"] a:hover { color:#25C2D8!important; }
    h1 { font-size:2rem!important; margin:.1rem 0!important; letter-spacing:-.03em; }
    h3 { font-size:1.02rem!important; text-transform:uppercase; letter-spacing:.06em; color:#dbe7f5!important; margin-top:1.4rem!important; }
    .eyebrow { color:#36c6d0; font-size:.72rem; font-weight:700; letter-spacing:.16em; }
    .subtitle { color:var(--muted); margin:.15rem 0 1.35rem; }
    .kpi-card { background:linear-gradient(145deg,#14243a,#0c1727); border:1px solid #22354f; border-radius:10px; padding:1rem; min-height:118px; box-shadow:0 8px 22px rgba(0,0,0,.16); }
    .kpi-top { display:flex; justify-content:space-between; color:#34c0c8; font-size:.64rem; font-weight:700; letter-spacing:.08em; }
    .kpi-value { font-size:1.75rem; font-weight:700; margin-top:.7rem; color:#f5f8fc; }
    .kpi-label { color:#9badc2; font-size:.74rem; line-height:1.2; }
    .section-gap { height:.4rem; }
    .alert-card { background:#0d1929; border:1px solid #273a55; border-left:4px solid #f6b84b; padding:1rem 1.2rem; border-radius:8px; margin:.5rem 0 1rem; }
    .alert-card.critical { border-left-color:#ef5b69; } .alert-card.high { border-left-color:#f08b50; }
    .alert-heading { display:flex; align-items:center; gap:.8rem; color:#aebdd0; } .alert-heading strong { color:#f1f5fa; margin-right:auto; }
    .pill { padding:.22rem .5rem; border-radius:12px; font-size:.68rem; font-weight:700; background:#57303a; color:#ff9ca8; }
    .pill.high { background:#533526;color:#ffc08e}.pill.medium{background:#4a4324;color:#ffe080}.pill.low{background:#1e443d;color:#77e2c3}
    .alert-description { font-size:1.05rem; margin:.9rem 0; color:#e6edf7; }
    .alert-grid { display:grid; grid-template-columns:1fr 1.5fr .7fr; gap:1.5rem; color:#bbc9da; font-size:.82rem; }
    .alert-grid label { display:block; color:#71869f; font-size:.62rem; font-weight:700; letter-spacing:.08em; margin-bottom:.2rem; }
    .anomaly-detail-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1rem 1.3rem; margin-top:1rem; color:#BBC9DA; font-size:.82rem; }
    .anomaly-detail-grid label { display:block; color:#88A0B9; font-size:.62rem; font-weight:700; letter-spacing:.08em; margin-bottom:.2rem; }
    .module-disclaimer { margin:.4rem 0 1.2rem; padding:.7rem 1rem; border-left:3px solid #25C2D8; background:#0D1C2D; color:#B7C8DA; font-size:.78rem; border-radius:5px; }
    .process-flow { padding:1rem; text-align:center; background:#0d1c2d; border:1px solid #29415b; border-radius:8px; color:#e6eef8; font-weight:600; letter-spacing:.03em; }
    .summary-row { display:flex; justify-content:space-between; padding:.7rem .85rem; margin:.35rem 0; background:#101d2f; border:1px solid #23344b; border-radius:7px; color:#aebdd0; }
    .summary-row strong { color:#f1f6fb; font-size:1.05rem; }
    [data-testid="stDataFrame"] { border:1px solid #213249; border-radius:8px; overflow:hidden; }
    .disclaimer { padding:.8rem; border:1px solid #2b405d; background:#0c1828; border-radius:8px; color:#9FB3C8!important; font-size:.72rem; line-height:1.35; }
    div.stButton > button { border-color:#2e536d; background:#12263a; color:#dbe7f5; }
    div.stButton > button:hover { border-color:#25b8c1; color:white; }
</style>
""", unsafe_allow_html=True)

with st.sidebar:
    st.markdown("## ⚓ MARITIME AI")
    st.caption("OPERATIONS CONTROL TOWER")
    st.markdown("---")
    modules = ["Executive Dashboard", "Fleet Overview", "Anomaly Detection", "Predictive Maintenance", "Voyage & Fuel Optimisation", "Safety Monitoring", "Automation Centre"]
    selected_module = st.radio("Navigation", modules, label_visibility="collapsed")
    st.markdown("---")
    st.markdown("<div class='disclaimer'>This conceptual prototype uses synthetic operational data. Values, recommendations and predictions are illustrative and are not based on any organisation's production systems.</div>", unsafe_allow_html=True)
    st.caption("Prototype environment · v0.1")

if selected_module == "Executive Dashboard":
    render_executive_dashboard()
elif selected_module == "Fleet Overview":
    render_fleet_overview()
elif selected_module == "Anomaly Detection":
    render_anomaly_detection()
elif selected_module == "Predictive Maintenance":
    render_predictive_maintenance()
elif selected_module == "Voyage & Fuel Optimisation":
    render_voyage_optimisation()
elif selected_module == "Safety Monitoring":
    render_safety_monitoring()
elif selected_module == "Automation Centre":
    render_automation_centre()
else:
    st.markdown(f"<div class='eyebrow'>MARITIME AI MODULE</div><h1>{selected_module}</h1>", unsafe_allow_html=True)
    st.info("Module under development.", icon="🛠️")
