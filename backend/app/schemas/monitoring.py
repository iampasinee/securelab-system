from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import DTO, Versioned


class SecuritySettings(Versioned):
    multiple_face_detection: bool
    looking_away_detection: bool
    looking_away_threshold_seconds: int = Field(gt=0, le=3600)
    window_switch_detection: bool
    allowed_window_switches: int = Field(ge=0, le=10000)
    url_whitelist_enforcement: bool
    allowed_domains: list[str] = Field(default_factory=list, max_length=200)


class SimulatedViolation(DTO):
    student_id: UUID
    type: Literal['unauthorized_website', 'duplicate_login', 'unauthorized_device', 'tab_switch', 'peripheral_connected']
    detail: str = Field(min_length=1, max_length=2000)
