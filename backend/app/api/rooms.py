from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, exists

from app.api.dependencies import database, current_user, admin, staff
from app.core.errors import missing
from app.models import floors, physical_rooms, exam_rooms, room_seats, computer_devices
from app.repositories.base import get
from app.schemas.rooms import FloorWrite, FloorUpdate, PhysicalWrite, PhysicalUpdate, ExamRoomWrite, ExamRoomUpdate, Layout, DeviceWrite, DeviceUpdate
from app.services import rooms as service
from app.services.common import paginate, search_pattern, public


router = APIRouter(tags=['rooms', 'devices'])


@router.get('/rooms/floors')
def list_floors(status: str | None = None, page: int = Query(default=1, ge=1),
                page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    statement = select(floors)
    if status:
        statement = statement.where(floors.c.status == status)
    return paginate(db, statement.order_by(floors.c.floor_number, floors.c.id), page, page_size)


@router.post('/rooms/floors', status_code=201)
def create_floor(payload: FloorWrite, actor=Depends(admin), db=Depends(database)):
    return service.save_floor(db, actor, payload)


@router.patch('/rooms/floors/{identifier}')
def update_floor(identifier: UUID, payload: FloorUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save_floor(db, actor, payload, identifier)


@router.delete('/rooms/floors/{identifier}', status_code=204)
def delete_floor(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    service.remove(db, actor, floors, identifier)


@router.get('/rooms/physical-rooms')
def list_physical(floor_id: UUID | None = Query(default=None, alias='floorId'), q: str | None = None, status: str | None = None, opened: bool | None = None,
                  page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    statement = select(physical_rooms)
    if floor_id:
        statement = statement.where(physical_rooms.c.floor_id == floor_id)
    if q:
        statement = statement.where(physical_rooms.c.room_code.ilike(search_pattern(q), escape='\\'))
    if status:
        statement = statement.where(physical_rooms.c.status == status)
    if opened is not None:
        statement = statement.where(exists(select(exam_rooms.c.id).where(exam_rooms.c.physical_room_id == physical_rooms.c.id)) == opened)
    return paginate(db, statement.order_by(physical_rooms.c.room_code, physical_rooms.c.id), page, page_size, lambda row: service.physical_dto(db, row))


@router.get('/rooms/physical-rooms/{identifier}')
def physical_detail(identifier: UUID, actor=Depends(staff), db=Depends(database)):
    return service.physical_dto(db, get(db, physical_rooms, identifier))


@router.post('/rooms/physical-rooms', status_code=201)
def create_physical(payload: PhysicalWrite, actor=Depends(admin), db=Depends(database)):
    return service.save_physical(db, actor, payload)


@router.patch('/rooms/physical-rooms/{identifier}')
def update_physical(identifier: UUID, payload: PhysicalUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save_physical(db, actor, payload, identifier)


@router.delete('/rooms/physical-rooms/{identifier}', status_code=204)
def delete_physical(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    service.remove(db, actor, physical_rooms, identifier)


@router.get('/rooms/exam-rooms')
def list_rooms(status: str | None = None, floor_id: UUID | None = Query(default=None, alias='floorId'), page: int = Query(default=1, ge=1),
               page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    statement = select(exam_rooms)
    if status:
        statement = statement.where(exam_rooms.c.status == status)
    if floor_id:
        statement = statement.where(exam_rooms.c.physical_room_id.in_(select(physical_rooms.c.id).where(physical_rooms.c.floor_id == floor_id)))
    return paginate(db, statement.order_by(exam_rooms.c.id), page, page_size, lambda row: service.room_dto(db, row))


@router.get('/rooms/exam-rooms/{identifier}')
def room_detail(identifier: UUID, actor=Depends(current_user), db=Depends(database)):
    return service.room_dto(db, get(db, exam_rooms, identifier), actor, include_layout=True)


@router.post('/rooms/exam-rooms', status_code=201)
def create_room(payload: ExamRoomWrite, actor=Depends(admin), db=Depends(database)):
    return service.save_room(db, actor, payload)


@router.patch('/rooms/exam-rooms/{identifier}')
def update_room(identifier: UUID, payload: ExamRoomUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save_room(db, actor, payload, identifier)


@router.delete('/rooms/exam-rooms/{identifier}', status_code=204)
def delete_room(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    service.remove(db, actor, exam_rooms, identifier)


@router.put('/rooms/exam-rooms/{identifier}/layout')
def layout(identifier: UUID, payload: Layout, actor=Depends(admin), db=Depends(database)):
    return service.layout(db, actor, identifier, payload)


def device_access(db, actor, identifier):
    device = get(db, computer_devices, identifier)
    if actor['role'] != 'admin':
        if not device['seat_id'] or get(db, room_seats, device['seat_id'])['exam_room_id'] not in service.allowed_room_ids(db, actor):
            missing()
    return device


@router.get('/devices')
def list_devices(room_id: UUID | None = Query(default=None, alias='roomId'), status: str | None = None, q: str | None = None,
                 page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    statement = select(computer_devices)
    if actor['role'] != 'admin':
        statement = statement.where(computer_devices.c.seat_id.in_(select(room_seats.c.id).where(room_seats.c.exam_room_id.in_(service.allowed_room_ids(db, actor)))))
    if room_id:
        statement = statement.where(computer_devices.c.seat_id.in_(select(room_seats.c.id).where(room_seats.c.exam_room_id == room_id)))
    if status:
        statement = statement.where(computer_devices.c.status == status)
    if q:
        statement = statement.where(computer_devices.c.computer_code.ilike(search_pattern(q), escape='\\') | computer_devices.c.serial_number.ilike(search_pattern(q), escape='\\'))
    return paginate(db, statement.order_by(computer_devices.c.computer_code, computer_devices.c.id), page, page_size, lambda row: service.device_dto(db, row))


@router.get('/devices/{identifier}')
def device_detail(identifier: UUID, actor=Depends(staff), db=Depends(database)):
    return service.device_dto(db, device_access(db, actor, identifier))


@router.post('/devices', status_code=201)
def create_device(payload: DeviceWrite, actor=Depends(admin), db=Depends(database)):
    return service.save_device(db, actor, payload)


@router.patch('/devices/{identifier}')
def update_device(identifier: UUID, payload: DeviceUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save_device(db, actor, payload, identifier)


@router.delete('/devices/{identifier}', status_code=204)
def delete_device(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    service.remove(db, actor, computer_devices, identifier)
