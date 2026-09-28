# Authentication, Role-Based Approvals & Site Scope (Phases 2–3)

Principle: **AI proposes. A signed-in person decides, and only within their role's authority and for the
vessels or terminals they are responsible for.**
Every decision, login and account change is attributed to an authenticated user and role in the audit trail.

## Scope

- Applies to **API mode** (FastAPI backend). In the static GitHub Pages demo there is no backend, so there is no
  login. Decision panels there explain that API mode is required.
- A prototype-grade implementation with no external identity provider and no paid services. Production path: see
  *Next steps*.

## Roles and authority

| Role | Request AI recommendation / start review | Approve · reject · execute (simulated) · cancel | Manage users |
|---|---|---|---|
| Viewer | – | – | – |
| Duty Officer (`operator`) | ✔ | – | – |
| Chief Engineer | ✔ | Anomaly, Maintenance | – |
| Technical Superintendent | ✔ | Anomaly, Maintenance | – |
| Master | ✔ | Voyage, Safety | – |
| Marine Superintendent | ✔ | Voyage | – |
| HSE Manager | ✔ | Safety | – |
| Administrator | – | – | ✔ |

Rules enforced by the backend (`app/security/permissions.py`, `app/services/decision_service.py`):

1. **Domain authority**: approval rights follow the operational domain (engineering, navigation, HSE).
2. **Four-eyes rule**: a *safety-critical* recommendation cannot be approved by the person who requested it.
   They may still reject it.
3. **Separation of duties**: administrators manage accounts but hold no operational approval authority. They
   cannot change their own role or deactivate themselves.
4. **Identity from the session only**: request bodies cannot carry an actor name (extra fields are rejected).
5. **Execution** remains simulated and requires a prior approval plus an authorised role.
6. **Site scope** (Phase 3): authority is limited to assigned vessels or terminals (see below).

## Site scope (per-vessel authority)

Every decision belongs to a **site**, either a vessel (`VES-001` … `VES-010`) or a terminal
(`TRM-NORTH-CONTAINER-TERMINAL`, `TRM-SOUTH-CONTAINER-TERMINAL`). The site is resolved when the recommendation is
generated and is stored on the decision:

| Decision domain | Site source |
|---|---|
| Voyage | `vessel_id` of the voyage plan |
| Anomaly, Maintenance, Safety | `vessel_or_terminal` of the record, matched to the fleet register (otherwise a terminal) |

| Role type | Allowed scope |
|---|---|
| Shipboard: Master, Chief Engineer | One or more **vessels** (required). Never fleet-wide, never terminals |
| Shore: Technical Superintendent, Marine Superintendent, HSE Manager, Duty Officer | **Fleet-wide** (the default) or specific vessels and/or terminals |
| Viewer, Administrator | No scope (no write authority) |

Rules:

- Scope applies to **all write actions**: request, review, approve, reject, execute and cancel. Reading stays fleet-wide
  so everyone keeps the full operational picture.
- The scope check is combined with the role check: a Master needs both the Master role for the domain **and** the
  decision's vessel in their scope.
- **Fails closed**: an account with no scope (for example created before Phase 3 and not yet scoped) has no write
  authority. A decision whose site cannot be resolved can only be handled by fleet-wide users.
- Scope is loaded on every request, so an administrator's change takes effect immediately without re-login. It is
  audited as `USER_UPDATED` with before/after site lists.
- Decisions created before Phase 3 have their site resolved once, on first use, and stored.
- Errors use code `out_of_scope` (HTTP 403) and name both the decision's site and the user's assigned sites.

Demo scope: `master` and `chief.engineer` → MV Horizon Star; `master.meridian` and `chief.meridian` → MV Meridian;
shore demo roles are fleet-wide.

The UI mirrors these rules. Buttons are disabled and explain why (for example "Approval requires HSE Manager or
Master", or the four-eyes note), but the backend is the authority.

## Authentication design

| Aspect | Implementation |
|---|---|
| Passwords | PBKDF2-HMAC-SHA256 (Python standard library), 600,000 iterations by default, per-user random salt |
| Password policy | ≥ 10 characters, upper- and lower-case letters and a digit |
| Sessions | Opaque random bearer token (256-bit); the database stores only its SHA-256 hash; default lifetime 8 h |
| Logout / revocation | Logout revokes the session. A role change, deactivation or password reset revokes all of that user's sessions |
| Brute force | Account locks for 15 min after 5 consecutive failures (configurable); generic error message; equal-cost check for unknown users |
| Audit | `LOGIN_SUCCEEDED`, `LOGIN_FAILED` (with reason), `LOGOUT`, `USER_CREATED`, `USER_UPDATED` (with changed fields; passwords never logged) |
| Browser storage | Token in `sessionStorage` (tab-scoped, cleared on close); a 401 anywhere signs the user out |
| CORS | Configured origins only; `Authorization` and `Content-Type` headers; no cookies/credentials |

## Endpoints

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/logout` | Signed in |
| GET | `/api/v1/auth/me` | Signed in: user, role, permissions, site scope, approval matrix |
| GET | `/api/v1/sites` | Signed in: vessels and terminals that decisions and scopes refer to |
| GET | `/api/v1/auth/approval-matrix` | Signed in |
| GET/POST | `/api/v1/users` | Administrator |
| PATCH | `/api/v1/users/{id}` | Administrator (role, display name, active, password reset, `fleet_wide`, `site_ids`) |
| GET | `/api/v1/health` | Public |
| All data, decision and audit endpoints | | Signed in (role checks in the services) |

## Provisioning accounts

No password is stored in the repository.

```bash
cd backend
# Demo role accounts (admin, duty.officer, chief.engineer, master, chief.meridian, master.meridian,
# tech.super, marine.super, hse.manager, viewer). Existing demo accounts without a scope get their demo scope.
python -m app.cli seed-demo-users          # prompts for one shared password
# or, for a local demo only, set DEMO_USERS_PASSWORD in backend/.env before starting the API

# Individual accounts
python -m app.cli list-sites
python -m app.cli create-user --username j.smith --display-name "J. Smith" --role chief_engineer --sites VES-001
python -m app.cli create-user --username a.khan --display-name "A. Khan" --role hse_manager --fleet-wide
python -m app.cli list-users
```

Administrators can then manage accounts in the UI (**User Administration**).

## Database upgrade

The new tables (`users`, `auth_sessions`) are created automatically. Columns added to existing tables are nullable
and are added automatically to an older local database at startup. A logged warning lists each one.

## Known limitations / next steps

- **SSO**: replace local passwords with OpenID Connect (e.g. Microsoft Entra ID) and map directory groups to roles.
- **MFA** for approver roles.
- **Time-bound assignments** (crew rotation): assignment start and end dates, and handover between Masters.
- **Delegation** (for example to a Chief Officer during the Master's absence), with an audit trail.
- **TLS** is required for any non-local deployment (tokens are bearer credentials).
- **XSS exposure**: `sessionStorage` tokens can be read by injected script. The app avoids `dangerouslySetInnerHTML`
  and `eval` (checked by the security agent). A stricter option is an HttpOnly cookie with CSRF protection.
- **Alembic migrations** before a shared PostgreSQL deployment.
