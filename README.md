# Maritime AI Operations Control Tower

An enterprise-style Streamlit prototype for exploring fictional maritime operations. It uses synthetic data and transparent illustrative rules; it does not contain genuine machine-learning models or production integrations.

## Available modules

- **Executive Dashboard** — fleet, voyage, equipment, alert, maintenance and safety overview.
- **Fleet Overview** — vessel map, health, delay, fuel and operational-status management.
- **Anomaly Detection** — vessel-engine, fuel-performance, quay-crane and reefer anomaly review.
- **Predictive Maintenance** — asset health, failure exposure, maintenance scheduling, spare parts and simulated work orders.
- **Voyage & Fuel Optimisation** — voyage comparison, route maps and an adjustable fuel/ETA simulator.
- **Safety Monitoring** — synthetic safety events, risk trends, corrective actions and event workflows.
- **Automation Centre** — human-controlled review, approval and simulated workflow execution.

## SQLite architecture

SQLite is the primary runtime data source. The database is:

```text
data/maritime_ai.db
```

Python’s built-in `sqlite3` package is used through short-lived connections. Writes use transactions with rollback, a busy timeout and WAL journaling. Queries are isolated in the repository layer and use parameters for values.

Core tables:

```text
vessels                    voyages
equipment                  anomalies
sensor_readings            maintenance_assets
maintenance_history        work_orders
safety_events              safety_observations
corrective_actions         automation_workflows
automation_tasks           action_history
application_settings
```

Additional compatibility tables preserve existing functional modules:

```text
alerts                     voyage_plans
fuel_performance           weather_routes
```

Every operational table has an integer primary key plus `created_at` and `updated_at` fields. Existing CSV columns are preserved.

## CSV seed and backup data

CSV files remain in `data/` as initial seed and backup data. They are read only when a new database needs to be seeded; Streamlit pages read SQLite during normal operation.

A migration-time copy of the original CSVs is preserved at:

```text
data/csv_backup_2026-07-23/
```

## Project structure

```text
app.py                         Streamlit startup, theme and navigation
database/
  connection.py               Safe connections and transaction contexts
  schema.py                   Table catalogue and schema evolution
  seed_database.py            Idempotent CSV seed import
  repositories.py             Parameterised data-access functions
scripts/
  initialise_database.py      Manual database initialisation
utils/
  data_loader.py              Pandas-facing database loader
  database_helpers.py         Table-to-CSV export helper
  *_generator.py              Synthetic CSV generators
  *_calculations.py           Transparent prototype calculations
pages/                         Seven functional Streamlit modules
tests/                         UI, action and database regression tests
data/                          SQLite database and preserved CSV seeds
```

## Installation

Python 3.10 or newer is recommended.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

No external database server or ORM is required.

## First-time initialisation

The Streamlit application automatically creates and seeds the database when `data/maritime_ai.db` does not exist.

To initialise it manually:

```powershell
python scripts/initialise_database.py
```

The process:

1. Creates missing tables.
2. Adds previously unseen CSV fields safely.
3. Imports each available seed CSV.
4. Logs imported files and record counts.
5. Stores a seed-version marker in `application_settings`.
6. Skips repeated imports on later runs.

Missing CSV files are logged and skipped without preventing other datasets from loading.

## Run the application

```powershell
streamlit run app.py
```

## Reset the prototype database

Stop Streamlit first. Rename the database so it remains recoverable:

```powershell
Move-Item data\maritime_ai.db data\maritime_ai.backup.db
```

Then restart Streamlit or run:

```powershell
python scripts/initialise_database.py
```

A fresh database will be created from the preserved CSV seeds. If SQLite sidecar files named `maritime_ai.db-wal` or `maritime_ai.db-shm` exist, ensure Streamlit is fully stopped before handling them.

## Back up or export data

For a full backup, stop Streamlit and copy the database:

```powershell
Copy-Item data\maritime_ai.db data\maritime_ai.backup.db
```

Individual tables can be exported using `utils.database_helpers.export_table_to_csv`:

```python
from utils.database_helpers import export_table_to_csv

export_table_to_csv("vessels", "data/exports/vessels.csv")
```

## Current limitations and next step

- SQLite persists the seeded operational records.
- Existing interface actions, work orders, scenarios, approvals and action histories still use `st.session_state`.
- Session actions can reset when the browser session or application process ends and are not yet written back to SQLite.
- The next migration step is persistent action updates and a durable audit trail in `action_history`.
- There is no login, authentication, role-based access control or external API integration in this version.
- Calculations and thresholds are illustrative and are not approved engineering, navigational, safety or commercial guidance.

Later phases may add authenticated login, role-based permissions, governed API integrations and PostgreSQL for multi-user deployments.

## Synthetic-data disclaimer

This is a generic maritime-industry concept. It does not represent or claim to use any organisation’s confidential data, systems, operating procedures, engineering limits, branding or proprietary algorithms.

> This conceptual prototype uses synthetic operational data. Values, recommendations and predictions are illustrative and are not based on any organisation's production systems.
