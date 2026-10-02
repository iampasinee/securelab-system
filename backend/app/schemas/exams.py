from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, create_model, field_validator

from app.models.exams import POLICY_GROUPS
from app.schemas.base import DTO, Versioned


CommonPolicy = create_model('CommonPolicy', __base__=DTO, **{name: (bool, False) for name in POLICY_GROUPS['common']})
FilePolicy = create_model('FilePolicy', __base__=DTO, **{name: (bool, name == 'lock_after_final_submit') for name in POLICY_GROUPS['file']})
OfflinePolicy = create_model('OfflinePolicy', __base__=DTO, **{name: (bool, False) for name in POLICY_GROUPS['offline']}, local_server_host=(str, Field(default='', max_length=255)))


class Resource(DTO):
    name: str = Field(min_length=1, max_length=200)
    type: Literal['website', 'web_app', 'application']
    value: str = Field(min_length=1, max_length=512)
    category: str | None = Field(default=None, max_length=100)


OnlineBooleans = create_model('OnlineBooleans', __base__=DTO, **{name: (bool, False) for name in POLICY_GROUPS['online']})


class OnlinePolicy(OnlineBooleans):
    resource_mode: Literal['allowlist', 'blocklist'] = 'allowlist'
    allowed_domains: list[str] = Field(default_factory=list, max_length=200)
    allowed_resources: list[Resource] = Field(default_factory=list, max_length=200)
    blocked_resources: list[Resource] = Field(default_factory=list, max_length=200)


class Policy(DTO):
    common: CommonPolicy = Field(default_factory=CommonPolicy)
    file: FilePolicy = Field(default_factory=FilePolicy)
    online: OnlinePolicy = Field(default_factory=OnlinePolicy)
    offline: OfflinePolicy = Field(default_factory=OfflinePolicy)


class Rule(DTO):
    text: str = Field(min_length=1, max_length=10000)
    is_custom: bool = False


class ExamWrite(DTO):
    section_id: UUID
    exam_room_id: UUID = Field(alias='roomId')
    name: str = Field(min_length=1, max_length=200)
    exam_type: Literal['midterm', 'final', 'lab', 'quiz', 'other']
    mode: Literal['online', 'offline']
    starts_at: datetime
    ends_at: datetime
    max_file_size_bytes: int = Field(ge=1, le=500 * 1024 * 1024)
    required_file_count: int = Field(ge=1, le=1000)
    filename_pattern: str = Field(min_length=1, max_length=255)
    automatic_filename_template: str | None = Field(default=None, max_length=255)
    instructions: str = Field(default='', max_length=50000)
    accepted_extensions: list[str] = Field(min_length=1, max_length=100)
    rules: list[Rule] = Field(default_factory=list, max_length=100)
    policy: Policy = Field(default_factory=Policy)

    @field_validator('starts_at', 'ends_at')
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError('เวลาต้องมี timezone')
        return value


class ExamUpdate(ExamWrite, Versioned):
    pass


class SeatAssignmentWrite(Versioned):
    student_id: UUID


class TimeAdjustment(Versioned):
    delta_minutes: int = Field(ge=-1440, le=1440)
    reason: str = Field(min_length=1, max_length=2000)


class Reopen(DTO):
    scope: Literal['student', 'room']
    student_id: UUID | None = None
    minutes: int = Field(ge=5, le=60)
    reason: str = Field(min_length=1, max_length=2000)
