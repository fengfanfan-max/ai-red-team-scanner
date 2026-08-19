"""Application API-key encryption (Fernet).

Dev default: derive a stable key from JWT_SECRET so local dev works with zero
configuration. Production MUST set ENCRYPTION_KEY explicitly (Fernet key).

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings


def _fernet(settings: Settings) -> Fernet:
    if settings.encryption_key:
        return Fernet(settings.encryption_key.encode("utf-8"))
    digest = hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_api_key(plain: str, settings: Settings) -> str:
    return _fernet(settings).encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_api_key(cipher: str, settings: Settings) -> str | None:
    try:
        return _fernet(settings).decrypt(cipher.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


def mask_api_key(plain: str) -> str:
    """Return a display-safe masked form, e.g. `sk-****abcd`."""
    if len(plain) <= 8:
        return "****"
    return f"{plain[:3]}****{plain[-4:]}"
