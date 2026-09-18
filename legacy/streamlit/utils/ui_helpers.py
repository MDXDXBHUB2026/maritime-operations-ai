"""Shared presentation helpers for consistent Control Tower modules."""

from __future__ import annotations

import html
from pathlib import Path

import pandas as pd
import streamlit as st
from utils.data_loader import load_table


def load_data(path: str | Path, required: set[str], dates: list[str] | None = None) -> pd.DataFrame:
    """Load the SQLite table corresponding to a preserved CSV seed filename."""
    return load_table(Path(path).stem, required, dates)


def kpi_cards(values: dict[str, str | int | float], label: str = "LIVE") -> None:
    """Render the shared enterprise KPI-card design."""
    icons = ["◉", "◆", "!", "◷", "↘", "%"]
    columns = st.columns(len(values))
    for column, (name, value), icon in zip(columns, values.items(), icons * 2):
        with column:
            st.markdown(
                f"<div class='kpi-card'><div class='kpi-top'><span>{icon}</span>"
                f"<span>{html.escape(label)}</span></div><div class='kpi-value'>{value}</div>"
                f"<div class='kpi-label'>{html.escape(name)}</div></div>",
                unsafe_allow_html=True,
            )


def page_header(eyebrow: str, title: str, subtitle: str, disclaimer: str) -> None:
    """Render a standard module heading and synthetic-data disclaimer."""
    st.markdown(
        f"<div class='eyebrow'>{html.escape(eyebrow)}</div><h1>{html.escape(title)}</h1>"
        f"<p class='subtitle'>{html.escape(subtitle)}</p>"
        f"<div class='module-disclaimer'>{html.escape(disclaimer)}</div>",
        unsafe_allow_html=True,
    )


def show_flash(prefix: str) -> None:
    """Display persistent session confirmation/error messages."""
    confirmation = st.session_state.get(f"{prefix}_confirmation")
    error = st.session_state.get(f"{prefix}_error")
    if confirmation:
        st.success(confirmation, icon="✅")
    if error:
        st.error(error, icon="🚨")


def append_history(key: str, record: dict) -> None:
    """Append a timestamped action record to session state."""
    if key not in st.session_state:
        st.session_state[key] = []
    st.session_state[key].append(
        {"timestamp": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"), **record}
    )


def history_table(key: str, columns: list[str], labels: list[str], empty: str) -> None:
    """Render a newest-first session action history table."""
    history = pd.DataFrame(st.session_state.get(key, []))
    if history.empty:
        st.caption(empty)
        return
    display = history[columns].iloc[::-1].copy()
    display.columns = labels
    st.dataframe(display, hide_index=True, width="stretch")
