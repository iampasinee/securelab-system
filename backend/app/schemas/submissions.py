from pydantic import Field

from app.schemas.base import DTO, Versioned


class AttemptStart(DTO):
    rules_accepted: bool
    accepted_exam_revision: int = Field(ge=1)


class FileIntent(DTO):
    original_name: str = Field(min_length=1, max_length=255)
    expected_size_bytes: int = Field(ge=1, le=500 * 1024 * 1024)
    client_mime: str | None = Field(default=None, max_length=255)


class FileRename(Versioned):
    submission_base_name: str = Field(min_length=1, max_length=100, pattern='^[A-Za-z0-9_-]+$')
