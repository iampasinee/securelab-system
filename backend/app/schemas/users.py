from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import DTO, Versioned


class StudentProfile(DTO):
    student_code: str = Field(pattern='^[0-9]{10,15}$')
    major_id: UUID
    admission_year: int = Field(ge=2500, le=32767)
    class_group_id: UUID | None = None
    first_name: str | None = Field(default=None, max_length=150)
    last_name: str | None = Field(default=None, max_length=150)
    first_name_th: str | None = Field(default=None, max_length=150)
    last_name_th: str | None = Field(default=None, max_length=150)
    first_name_en: str | None = Field(default=None, max_length=150)
    last_name_en: str | None = Field(default=None, max_length=150)


class TeacherProfile(DTO):
    teacher_code: str = Field(min_length=1, max_length=30)
    department_id: UUID
    icit_profile_status: Literal['pending', 'confirmed'] = 'pending'


class AdminProfile(DTO):
    admin_code: str = Field(min_length=1, max_length=30)


class UserCreate(DTO):
    role: Literal['student', 'teacher', 'admin']
    email: str = Field(min_length=1, max_length=254)
    full_name: str = Field(min_length=1, max_length=200)
    account_status: Literal['active', 'suspended', 'graduated_inactive'] = 'active'
    profile: StudentProfile | TeacherProfile | AdminProfile


class UserUpdate(Versioned):
    email: str | None = Field(default=None, min_length=1, max_length=254)
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    profile: StudentProfile | TeacherProfile | AdminProfile | None = None


class StatusUpdate(Versioned):
    status: Literal['active', 'suspended', 'graduated_inactive']
    reason: str | None = Field(default=None, max_length=2000)
