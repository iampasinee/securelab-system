from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import DTO, Versioned


class AcademicWrite(DTO):
    code: str | None = Field(default=None, max_length=30)
    name: str = Field(default='', max_length=150)
    status: Literal['active', 'inactive'] = 'active'
    faculty_id: UUID | None = None
    department_id: UUID | None = None
    major_id: UUID | None = None
    admission_year: int | None = Field(default=None, ge=2500, le=32767)


class AcademicUpdate(AcademicWrite, Versioned):
    pass


class SettingsUpdate(Versioned):
    current_academic_year: int = Field(ge=2500, le=32767)
    current_semester: Literal['1', '2', 'summer']


class StructureChoice(DTO):
    mode: Literal['existing', 'new']
    existing_id: UUID | None = None
    code: str = Field(default='', max_length=30)
    name: str = Field(default='', max_length=150)
    status: Literal['active', 'inactive'] = 'active'


class StructureDraft(DTO):
    faculty: StructureChoice
    department: StructureChoice
    major: StructureChoice
    admission_year: int = Field(ge=2500, le=32767)
    group_count: int = Field(ge=1, le=20)


class GroupAssignments(DTO):
    student_ids: list[UUID] = Field(min_length=1, max_length=1000)
    allow_reassign: bool = False
