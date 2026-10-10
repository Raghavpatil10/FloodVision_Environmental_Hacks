import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator

EMAIL_REGEX = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of the user")
    email: str = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, description="Password (at least 8 characters with letters and numbers)")
    confirm_password: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("Invalid email format. Please provide a valid address like user@example.com.")
        return clean

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Name must be at least 2 characters long")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one letter and one number.")
        return v

class LoginRequest(BaseModel):
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")
    remember_me: Optional[bool] = Field(default=False, description="Persist session for extended duration")

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool = True
    created_at: str
    updated_at: Optional[str] = None
    last_login: Optional[str] = None

class AuthResponse(BaseModel):
    user: UserResponse
    message: str
