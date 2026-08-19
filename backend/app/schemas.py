from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None
    email: str
    name: str
    guest: bool = False
    created_at: datetime | None = None


# ============================================
# AI Applications
# ============================================

TEXT_ONLY = ["text"]


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=4, max_length=500)
    api_key: str = Field(default="", max_length=500)
    model_name: str = Field(min_length=1, max_length=200)
    input_modalities: list[str] = Field(default_factory=lambda: list(TEXT_ONLY))
    output_modalities: list[str] = Field(default_factory=lambda: list(TEXT_ONLY))


class ApplicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_url: str | None = Field(default=None, min_length=4, max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
    model_name: str | None = Field(default=None, min_length=1, max_length=200)
    input_modalities: list[str] | None = None
    output_modalities: list[str] | None = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    base_url: str
    api_key_masked: str
    model_name: str
    input_modalities: list[str]
    output_modalities: list[str]
    created_at: datetime
    updated_at: datetime


class TestChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class TestChatResponse(BaseModel):
    reply: str
    simulated: bool = False


TokenResponse.model_rebuild()
