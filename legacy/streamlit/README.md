# Legacy Streamlit Architecture Archive

This directory contains the complete, coherent historical Python & Streamlit implementation of the Maritime Operations AI Control Tower for reference and archival purposes.

## Migration Context
As part of the production migration to a static Single-Page Application (SPA) deployed to GitHub Pages, the application architecture transitioned to React 18, TypeScript (strict mode), Vite 6, and modern CSS.

Streamlit is no longer the active application architecture.

## Archived Components
- `app.py`: Original Streamlit entrypoint and navigation shell
- `pages/`: Original 7 Streamlit module implementations:
  - `executive_dashboard.py`
  - `fleet_overview.py`
  - `anomaly_detection.py`
  - `predictive_maintenance.py`
  - `voyage_optimisation.py`
  - `safety_monitoring.py`
  - `automation_centre.py`
- `database/`: Historical SQLite connection handling, schema definitions, and repositories
- `utils/`: Data generators, calculations, and UI helper functions
- `tests/`: Original Python pytest test suite for Streamlit & SQLite logic
- `scripts/initialise_database.py`: Database initialization script
- `requirements.txt`: Python package dependencies for running the Streamlit prototype
- `.streamlit/`: Streamlit configuration and theme settings
