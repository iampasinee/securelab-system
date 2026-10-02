from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import DTO, Versioned


class CourseWrite(DTO):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    department_id: UUID
    status: Literal['active', 'inactive'] = 'active'


class CourseUpdate(CourseWrite, Versioned):
    pass


class Cohort(DTO):
    major_id: UUID
    admission_year: int = Field(ge=2500, le=32767)
    class_group_ids: list[UUID] = Field(default_factory=list, max_length=1000)


class SectionWrite(DTO):
    course_id: UUID
    academic_year: int = Field(ge=2500, le=32767)
    semester: Literal['1', '2', 'summer']
    section_number: int = Field(ge=1)
    status: Literal['active', 'inactive'] = 'active'
    primary_teacher_id: UUID
    co_teacher_ids: list[UUID] = Field(default_factory=list, max_length=100)
    cohorts: list[Cohort] = Field(min_length=1, max_length=100)


class SectionUpdate(SectionWrite, Versioned):
    pass


class RosterInclusion(DTO):
    student_id: UUID


class RosterMove(RosterInclusion):
    target_section_id: UUID
