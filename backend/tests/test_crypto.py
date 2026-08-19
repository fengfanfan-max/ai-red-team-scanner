import pytest

from app.core.config import Settings
from app.core.crypto import decrypt_api_key, encrypt_api_key, mask_api_key


@pytest.fixture
def settings() -> Settings:
    return Settings()


def test_encrypt_decrypt_roundtrip(settings: Settings) -> None:
    cipher = encrypt_api_key("sk-secret-key-1234567890", settings)
    assert cipher != "sk-secret-key-1234567890"
    assert decrypt_api_key(cipher, settings) == "sk-secret-key-1234567890"


def test_decrypt_with_wrong_key_returns_none() -> None:
    cipher = encrypt_api_key("sk-secret-key-1234567890", Settings())
    wrong = Settings(jwt_secret="some-other-secret-0123456789abcdef01234567")
    assert decrypt_api_key(cipher, wrong) is None


def test_mask_api_key() -> None:
    assert mask_api_key("sk-abcdefghijkl") == "sk-****ijkl"
    assert mask_api_key("short") == "****"
