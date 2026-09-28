"""Account provisioning CLI. Passwords are read interactively or from an environment variable,
never from command-line arguments (which leak into shell history and process lists).

    python -m app.cli create-user --username jdoe --display-name "J. Doe" --role chief_engineer
    python -m app.cli seed-demo-users          # prompts for one shared demo password
    python -m app.cli list-users
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
from app.services.auth_service import AuthService, seed_demo_users


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

    seed = sub.add_parser("seed-demo-users", help="Create the demo role accounts (one shared password)")
    seed.add_argument("--password-env", help="Read the password from this environment variable")

    sub.add_parser("list-users", help="List user accounts")

    args = parser.parse_args(argv)
    settings = get_settings()
    engine = build_engine(settings.database_url)
    init_db(engine)
    session = build_session_factory(engine)()
    try:
        if args.command == "list-users":
            for u in AuthService(session, settings).list_users():
                print(f"{u.username:<20} {u.role_label:<26} {'active' if u.is_active else 'inactive'}")
            return
        password = _password(args.password_env)
        try:
            validate_password_policy(password)
        except ValueError as exc:
            sys.exit(str(exc))
        if args.command == "create-user":
            user = AuthService(session, settings).create_user(
                UserCreate(username=args.username, display_name=args.display_name,
                           role=Role(args.role), password=password))
            print(f"Created {user.username} ({user.role_label})")
        else:
            created = seed_demo_users(session, settings, password)
            print("Created: " + (", ".join(created) if created else "none (all demo users already exist)"))
    finally:
        session.close()


if __name__ == "__main__":
    main()
