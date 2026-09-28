# Shared backend for the public site (Supabase PostgreSQL + Vercel)

GitHub Pages serves static files only. To give the public site sign-in, shared decisions and a
persistent audit trail, the FastAPI backend runs on Vercel (serverless, free Hobby plan) and stores
data in Supabase PostgreSQL (free plan). If the backend is unreachable, the site falls back to the
in-browser demo automatically.

```
GitHub Pages (React)  --HTTPS-->  Vercel function (FastAPI, api/index.py, region bom1)
                                        |
                                        v
                                 Supabase PostgreSQL (ap-south-1, project maritime-operations-ai)
```

## Security model

- No secret is stored in the repository. `DATABASE_URL` and `DEMO_USERS_PASSWORD` live only in the
  Vercel project's environment variables.
- The frontend holds no keys. It calls the backend, which enforces roles, site scope, the four-eyes
  rule and approval before (simulated) execution.
- Row-level security is enabled on every backend table at startup, so Supabase's automatic REST
  API cannot read them (for example users, password hashes and session-token hashes). The backend
  connects as the table owner and is unaffected.
- `PUBLIC_DEMO=true` allows one-click sign-in to the non-admin demo accounts. The Administrator
  account is never reachable this way; it needs `DEMO_USERS_PASSWORD`. Use synthetic data only on
  a public demo: anything entered is visible to other visitors.
- CORS allows only the origins listed in `CORS_ORIGINS`.

## One-time setup

1. **Supabase connection string**
   - Supabase dashboard → project `maritime-operations-ai` → **Project Settings → Database** →
     *Reset database password* (choose a strong password and keep it private).
   - Click **Connect** → **Transaction pooler** and copy the URI
     (`postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:6543/postgres`).
2. **Vercel project**
   - Vercel → **Add New → Project** → import `MDXDXBHUB2026/maritime-operations-ai`.
   - Framework preset **Other**, root directory `./` (build settings come from `vercel.json`).
   - Environment variables:

     | Name | Value |
     | --- | --- |
     | `DATABASE_URL` | the Supabase transaction-pooler URI |
     | `DEMO_USERS_PASSWORD` | a strong password of your choice (Administrator sign-in) |
     | `PUBLIC_DEMO` | `true` |
     | `CORS_ORIGINS` | `https://mdxdxbhub2026.github.io` |

   - Deploy, then open `https://<project>.vercel.app/api/v1/health`; expect
     `"status":"ok"` and `"database":"ok (postgresql)"`.
3. **Point the public site at the backend**
   - GitHub → repository **Settings → Secrets and variables → Actions → Variables** → add
     `MARITIME_API_URL` = `https://<project>.vercel.app/api/v1` (a URL, not a secret).
   - **Actions → Deploy Maritime AI Control Tower to GitHub Pages → Run workflow**.

To switch the public site back to the browser-only demo, delete `MARITIME_API_URL` and re-run the
deploy workflow.

## Operating notes

- Free Supabase projects pause after about a week without activity. While paused, the site
  shows the browser demo; resume the project in the Supabase dashboard.
- Tables are created on first start (`create_all`). Introduce Alembic migrations before any
  schema change on a database holding data you want to keep.
- Local development is unchanged: SQLite by default, or any PostgreSQL via `DATABASE_URL`.
