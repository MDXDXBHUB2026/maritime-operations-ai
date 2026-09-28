"""Account provisioning CLI. Passwords are read interactively or from an environment variable,
never from command-line arguments (which leak into shell history and process lists).

    python -m app.cli create-user --username jdoe --display-name "J. Doe" --role chief_engineer --sites VES-001
    python -m app.cli seed-demo-users          # prompts for one shared demo password
    python -m app.cli list-users
    python -m app.cli list-sites
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from app.config import get_settings
from app.db.session import build_engine, build_session_factory, init_db
from app.domain.enums import Role
from app.domain.models import UserCreate
from app.security.passwords import validate_password_policy
from app.security.permissions import SCOPED_ROLES
from app.repositories.maritime_repository import JsonFileMaritimeRepository
from app.services.auth_service import AuthService, seed_demo_users
from app.services.maritime_service import MaritimeService


def _password(env_var: str | None) -> str:
    if env_var:
        value = os.environ.get(env_var)
        if not value:
            sys.exit(f"Environment variable {env_var} is not set")
        return value
    first = getpass.getpass("Password: ")
    if first != getpass.getpass("Repeat password: "):
        sys.exit("Passwords do not match")
    return first


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-user", help="Create a user account")
    create.add_argument("--username", required=True)
    create.add_argument("--display-name", required=True)
    create.add_argument("--role", required=True, choices=[r.value for r in Role])
    create.add_argument("--password-env", help="Read the password from this environment variable")
    create.add_argument("--sites", default="", help="Comma-separated site ids (e.g. VES-001); omit for the role default")
    create.add_argument("--fleet-wide", action="store_true", help="Grant fleet-wide scope (shore roles only)")

    seed = sub.add_parser("seed-demo-users", help="Create the demo role accounts (one shared password)")
    seed.add_argument("--password-env", help="Read the password from this environment variable")

    sub.add_parser("list-users", help="List user accounts")
    sub.add_parser("list-sites", help="List vessels and terminals that can be assigned")

    args = parser.parse_args(argv)
    settings = get_settings()
    engine = build_engine(settings.database_url)
    init_db(engine)
    session = build_session_factory(engine)()
    catalog = MaritimeService(JsonFileMaritimeRepository(settings.data_dir)).site_by_id
    try:
        if args.command == "list-sites":
            for site in catalog().values():
                print(f"{site.site_id:<32} {site.site_type.value:<9} {site.name}")
            return
        if args.command == "list-users":
            for u in AuthService(session, settings, catalog).list_users():
                if u.role not in SCOPED_ROLES:
                    scope = "n/a"
                else:
                    scope = "fleet-wide" if u.fleet_wide else (", ".join(s.site_id for s in u.sites) or "NONE")
                print(f"{u.username:<20} {u.role_label:<26} {'active' if u.is_active else 'inactive':<9} {scope}")
            return
        password = _password(args.password_env)
        try:
            validate_password_policy(password)
        except ValueError as exc:
            sys.exit(str(exc))
        if args.command == "create-user":
            sites = [s.strip() for s in args.sites.split(",") if s.strip()]
            user = AuthService(session, settings, catalog).create_user(
                UserCreate(username=args.username, display_name=args.display_name, role=Role(args.role),
                           password=password, site_ids=sites, fleet_wide=True if args.fleet_wide else None))
            scope = "fleet-wide" if user.fleet_wide else ", ".join(s.name for s in user.sites) or "no scope"
            print(f"Created {user.username} ({user.role_label}; {scope})")
        else:
            created = seed_demo_users(session, settings, password, catalog)
            print("Created: " + (", ".join(created) if created else "none (all demo users already exist)"))
    finally:
        session.close()


if __name__ == "__main__":
    main()
