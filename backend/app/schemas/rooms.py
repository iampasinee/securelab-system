from ipaddress import IPv4Address
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import DTO, Versioned


class FloorWrite(DTO):
    floor_number: int = Field(ge=0, le=200)
    status: Literal['active', 'inactive'] = 'active'


class FloorUpdate(FloorWrite, Versioned):
    pass


class PhysicalWrite(DTO):
    floor_id: UUID
    suffix: str = Field(min_length=1, max_length=70, pattern='^[A-Za-z0-9-]+$')
    status: Literal['active', 'inactive'] = 'active'


class PhysicalUpdate(PhysicalWrite, Versioned):
    pass


class ExamRoomWrite(DTO):
    physical_room_id: UUID
    status: Literal['ready', 'maintenance', 'inactive'] = 'ready'


class ExamRoomUpdate(ExamRoomWrite, Versioned):
    pass


class Layout(Versioned):
    rows: int = Field(ge=0, le=100)
    columns: int = Field(ge=0, le=100)


class DeviceWrite(DTO):
    computer_code: str = Field(min_length=1, max_length=80)
    serial_number: str = Field(min_length=1, max_length=120)
    ip_address: IPv4Address
    mac_address: str = Field(pattern=r'^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$')
    seat_id: UUID | None = None
    status: Literal['ready', 'maintenance', 'inactive'] = 'ready'


class DeviceUpdate(DeviceWrite, Versioned):
    pass
