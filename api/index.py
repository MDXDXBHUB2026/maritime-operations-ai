"""Vercel serverless entry point for the FastAPI decision-support backend.

Vercel's Python runtime serves the ASGI ``app`` defined here; vercel.json rewrites every request to
this function. Configuration comes from the Vercel project's environment variables (DATABASE_URL,
DEMO_USERS_PASSWORD, CORS_ORIGINS, PUBLIC_DEMO); nothing secret is stored in the repository.
"""

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))
os.environ.setdefault("SERVERLESS", "true")
os.environ.setdefault("DATA_DIR", str(REPO_ROOT / "public" / "data"))

from app.main import create_app  # noqa: E402

app = create_app()
