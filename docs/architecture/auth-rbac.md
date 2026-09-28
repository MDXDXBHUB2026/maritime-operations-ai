# Authentication & Role-Based Approvals (Phase 2)

Principle: **AI proposes. A signed-in person decides, and only within their role's authority.**
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
| GET | `/api/v1/auth/me` | Signed in: user, role, permissions, approval matrix |
| GET | `/api/v1/auth/approval-matrix` | Signed in |
| GET/POST | `/api/v1/users` | Administrator |
| PATCH | `/api/v1/users/{id}` | Administrator (role, display name, active, password reset) |
| GET | `/api/v1/health` | Public |
| All data, decision and audit endpoints | | Signed in (role checks in the services) |

## Provisioning accounts

No password is stored in the repository.

```bash
cd backend
# Demo role accounts (admin, duty.officer, chief.engineer, master, tech.super, marine.super, hse.manager, viewer)
python -m app.cli seed-demo-users          # prompts for one shared password
# or, for a local demo only, set DEMO_USERS_PASSWORD in backend/.env before starting the API

# Individual accounts
python -m app.cli create-user --username j.smith --display-name "J. Smith" --role chief_engineer
python -m app.cli list-users
```

Administrators can then manage accounts in the UI (**User Administration**).

## Database upgrade

The new tables (`users`, `auth_sessions`) are created automatically. Columns added to existing tables are nullable
and are added automatically to an older local database at startup. A logged warning lists each one.

## Known limitations / next steps

- **SSO**: replace local passwords with OpenID Connect (e.g. Microsoft Entra ID) and map directory groups to roles.
- **MFA** for approver roles.
- **Scope by fleet or vessel**: approvers are currently authorised fleet-wide. Next, restrict a Master's approvals to
  their own vessel.
- **TLS** is required for any non-local deployment (tokens are bearer credentials).
- **XSS exposure**: `sessionStorage` tokens can be read by injected script. The app avoids `dangerouslySetInnerHTML`
  and `eval` (checked by the security agent). A stricter option is an HttpOnly cookie with CSRF protection.
- **Alembic migrations** before a shared PostgreSQL deployment.
