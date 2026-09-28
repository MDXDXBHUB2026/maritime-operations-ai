"""Password hashing with PBKDF2-HMAC-SHA256 (Python standard library, no extra dependencies).

Stored format: ``pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

ALGORITHM = "pbkdf2_sha256"
MIN_PASSWORD_LENGTH = 10


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def hash_password(password: str, iterations: int) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"{ALGORITHM}${iterations}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations_text, salt_b64, hash_b64 = stored.split("$")
        if algorithm != ALGORITHM:
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations_text))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, expected)


def validate_password_policy(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if password.lower() == password or password.upper() == password or not any(c.isdigit() for c in password):
        raise ValueError("Password must contain upper- and lower-case letters and a digit")


def hash_token(token: str) -> str:
    """Session tokens are stored only as SHA-256 hashes."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)
