from typing import Literal

from pydantic import Field, SecretStr, field_validator

from app.schemas.base import DTO


def validate_password(value: str) -> str:
    import re
    if not 8 <= len(value) <= 128 or value != value.strip() or not re.search('[A-Za-z]', value) or not re.search('[0-9]', value):
        raise ValueError('รหัสผ่านต้องมี 8–128 ตัวอักษร มีอักษรภาษาอังกฤษและตัวเลข และไม่มีช่องว่างต้นหรือท้าย')
    return value


class Login(DTO):
    email: str = Field(max_length=254)
    password: SecretStr = Field(max_length=128)


class TokenInput(DTO):
    token: SecretStr = Field(min_length=32, max_length=128)


class PasswordComplete(TokenInput):
    new_password: SecretStr

    @field_validator('new_password')
    @classmethod
    def password_rules(cls, value):
        validate_password(value.get_secret_value())
        return value


class PasswordChange(DTO):
    current_password: SecretStr = Field(max_length=128)
    new_password: SecretStr

    @field_validator('new_password')
    @classmethod
    def password_rules(cls, value):
        validate_password(value.get_secret_value())
        return value


class AccountLink(DTO):
    purpose: Literal['activate', 'reset_password']
