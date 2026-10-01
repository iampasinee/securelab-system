import test from 'node:test';
import assert from 'node:assert/strict';
import { initialExamSessions, initialRooms, initialSeatAssignments } from '../data/initialData';
import type { RoomAction, RoomState } from '../types/rooms';
import {
  applyRoomAction,
  generateRoomCodeFromFloor,
  getRoomSuffixForFloor,
  migrateRoomState,
  normalizeRoomSuffix,
  projectRooms,
  resolveExamRoom,
  seatCode,
} from './roomState';

const empty = (): RoomState => ({
  version: 2,
  floors: [],
  physicalRooms: [],
  rooms: [],
  seats: [],
  computers: [],
});

function save(state: RoomState, action: RoomAction) {
  const result = applyRoomAction(state, action);
  assert.equal(result.success, true, result.error);
  return result.state!;
}

function fixture() {
  let state = save(empty(), { type: 'floor', floorNumber: 3, status: 'active' });
  const floorId = state.floors[0].id;
  state = save(state, { type: 'physicalRoom', floorId, roomCode: ' B3-01a ', status: 'active' });
  const physicalRoomId = state.physicalRooms[0].id;
  state = save(state, { type: 'room', floorId, physicalRoomId, status: 'ready' });
  const roomId = state.rooms[0].id;
  state = save(state, { type: 'layout', roomId, rows: 5, columns: 8 });
  const device: Extract<RoomAction, { type: 'computer' }> = {
    type: 'computer',
    floorId,
    roomId,
    seatId: state.seats[0].id,
    computerCode: 'PC-001',
    serialNumber: 'SN001',
    ipAddress: '10.0.1.101',
    macAddress: 'aa:bb:cc:dd:ee:01',
    status: 'ready',
  };
  return { state, floorId, physicalRoomId, roomId, device };
}

test('floor creation, editing, status and duplicate prevention', () => {
  let state = save(empty(), { type: 'floor', floorNumber: 3, status: 'active' });
  state = save(state, { type: 'floor', floorNumber: 4, status: 'active' });
  assert.equal(state.floors.length, 2);
  assert.equal(applyRoomAction(state, { type: 'floor', floorNumber: 3, status: 'active' }).success, false);
  state = save(state, { type: 'floor', id: state.floors[0].id, floorNumber: 5, status: 'inactive' });
  assert.equal(state.floors.at(-1)?.floorNumber, 5);
  assert.equal(state.floors.at(-1)?.status, 'inactive');
});

test('physical rooms belong to floors and normalize their room code', () => {
  const { state, floorId, physicalRoomId } = fixture();
  assert.deepEqual(state.physicalRooms[0], {
    id: physicalRoomId,
    floorId,
    roomCode: 'B3-01A',
    status: 'active',
  });
  assert.equal(resolveExamRoom(state, state.rooms[0]).physicalRoom?.id, physicalRoomId);
  assert.equal(resolveExamRoom(state, state.rooms[0]).floor?.id, floorId);
});

test('room-code helper generates from floor and normalized suffix', () => {
  assert.equal(generateRoomCodeFromFloor(4, '08'), 'B4-08');
  assert.equal(generateRoomCodeFromFloor(4, '01A'), 'B4-01A');
  assert.equal(generateRoomCodeFromFloor(4, ' 01a '), 'B4-01A');
  assert.equal(normalizeRoomSuffix(' 0 1 b '), '01B');
  assert.equal(generateRoomCodeFromFloor(4, '01/A'), '');
  assert.equal(getRoomSuffixForFloor('B4-01A', 4), '01A');
  assert.equal(getRoomSuffixForFloor('LAB 405', 4), null);
});

test('new physical-room actions require a generated floor-prefixed code while legacy codes remain editable', () => {
  let state = save(empty(), { type: 'floor', floorNumber: 4, status: 'active' });
  const floorId = state.floors[0].id;
  assert.equal(applyRoomAction(state, { type: 'physicalRoom', floorId, roomCode: 'LAB 408', status: 'active' }).success, false);
  state = migrateRoomState({
    version: 1,
    floors: state.floors,
    rooms: [{ id: 'legacy_exam', floorId, roomCode: 'LAB 405', status: 'ready', rows: 0, columns: 0 }],
    seats: [],
    computers: [],
  }, []);
  const legacy = state.physicalRooms[0];
  assert.equal(save(state, { type: 'physicalRoom', id: legacy.id, floorId, roomCode: legacy.roomCode, status: 'inactive' }).physicalRooms[0].roomCode, 'LAB 405');
});

test('duplicate room code is blocked within a floor but allowed on another floor', () => {
  const { state, floorId } = fixture();
  const generated = generateRoomCodeFromFloor(3, ' 01a ');
  assert.equal(applyRoomAction(state, { type: 'physicalRoom', floorId, roomCode: generated, status: 'active' }).success, false);
  let next = save(state, { type: 'floor', floorNumber: 4, status: 'active' });
  next = save(next, { type: 'physicalRoom', floorId: next.floors[1].id, roomCode: generateRoomCodeFromFloor(4, '01A'), status: 'active' });
  assert.equal(next.physicalRooms.length, 2);
  assert.equal(next.physicalRooms[1].roomCode, 'B4-01A');
});

test('exam room opens from one active physical room at most once', () => {
  const { state, floorId, physicalRoomId } = fixture();
  assert.equal(applyRoomAction(state, { type: 'room', floorId, physicalRoomId, status: 'ready' }).success, false);
  assert.equal(applyRoomAction(state, { type: 'room', floorId: 'missing', physicalRoomId, status: 'ready' }).success, false);
  let next = save(state, { type: 'physicalRoom', floorId, roomCode: 'B3-02', status: 'inactive' });
  assert.equal(applyRoomAction(next, { type: 'room', floorId, physicalRoomId: next.physicalRooms[1].id, status: 'ready' }).success, false);
  next = save(next, { type: 'floor', floorNumber: 4, status: 'active' });
  assert.equal(applyRoomAction(next, { type: 'room', floorId: next.floors[1].id, physicalRoomId, status: 'ready' }).success, false);
});

test('exam room relationship is locked after seats or exam history exist', () => {
  const { state, floorId, roomId } = fixture();
  const next = save(state, { type: 'physicalRoom', floorId, roomCode: 'B3-02', status: 'active' });
  assert.equal(applyRoomAction(next, {
    type: 'room',
    id: roomId,
    floorId,
    physicalRoomId: next.physicalRooms[1].id,
    status: 'ready',
  }).success, false);
  const statusOnly = save(next, {
    type: 'room',
    id: roomId,
    floorId,
    physicalRoomId: next.physicalRooms[0].id,
    status: 'maintenance',
  });
  assert.equal(statusOnly.rooms[0].status, 'maintenance');
});

test('floor and referenced physical-room deletion are guarded', () => {
  const { state, floorId, physicalRoomId } = fixture();
  assert.equal(applyRoomAction(state, { type: 'delete', entity: 'floors', id: floorId }).success, false);
  assert.equal(applyRoomAction(state, { type: 'delete', entity: 'physicalRooms', id: physicalRoomId }).success, false);
  const next = save(state, { type: 'floor', floorNumber: 4, status: 'active' });
  assert.equal(applyRoomAction(next, { type: 'physicalRoom', id: physicalRoomId, floorId: next.floors[1].id, roomCode: 'B3-01A', status: 'active' }).success, false);
});

test('floor overview counts physical rooms separately from exam rooms', () => {
  const { state, floorId } = fixture();
  const next = save(state, { type: 'physicalRoom', floorId, roomCode: 'B3-02', status: 'active' });
  const physicalCount = next.physicalRooms.filter((room) => room.floorId === floorId).length;
  const examCount = next.rooms.filter((room) => resolveExamRoom(next, room).floor?.id === floorId).length;
  assert.equal(physicalCount, 2);
  assert.equal(examCount, 1);
});

test('layout generates 40 seats with padded labels and stable IDs when increased', () => {
  const { state, roomId } = fixture();
  assert.equal(state.seats.length, 40);
  assert.equal(state.seats[0].seatCode, 'A01');
  const next = save(state, { type: 'layout', roomId, rows: 6, columns: 8 });
  assert.equal(next.seats.length, 48);
  assert.deepEqual(next.seats.slice(0, 40), state.seats);
  assert.equal(new Set(next.seats.map((seat) => seat.id)).size, 48);
  assert.equal(seatCode(27, 1), 'AA01');
  assert.equal(seatCode(28, 12), 'AB12');
});

test('layout is available only to active exam rooms', () => {
  const { state, floorId, physicalRoomId, roomId } = fixture();
  const inactivePhysical = save(state, { type: 'physicalRoom', id: physicalRoomId, floorId, roomCode: 'B3-01A', status: 'inactive' });
  assert.equal(applyRoomAction(inactivePhysical, { type: 'layout', roomId, rows: 6, columns: 8 }).success, false);
});

test('shrink blocks assigned computers including inactive ones, permits empty removed seats', () => {
  const { state, roomId, device } = fixture();
  const assigned = save(state, { ...device, seatId: state.seats.at(-1)!.id, status: 'inactive' });
  assert.equal(applyRoomAction(assigned, { type: 'layout', roomId, rows: 4, columns: 8 }).success, false);
  assert.equal(assigned.seats.length, 40);
  assert.equal(save(state, { type: 'layout', roomId, rows: 4, columns: 8 }).seats.length, 32);
});

test('invalid dimensions are rejected and clearing an unused layout is safe', () => {
  const { state, roomId } = fixture();
  for (const [rows, columns] of [[-1, 8], [1.5, 8], [0, 8], [100, 100]]) {
    assert.equal(applyRoomAction(state, { type: 'layout', roomId, rows, columns }).success, false);
  }
  assert.equal(save(state, { type: 'layout', roomId, rows: 0, columns: 0 }).seats.length, 0);
});

test('computer creation normalizes metadata and projection resolves one canonical assignment', () => {
  const { state, device } = fixture();
  const next = save(state, { ...device, serialNumber: ' SN001 ' });
  assert.equal(next.computers[0].macAddress, 'AA:BB:CC:DD:EE:01');
  assert.equal(next.computers[0].serialNumber, 'SN001');
  assert.equal(projectRooms(next)[0].seats[0].machineNo, 'PC-001');
  assert.equal(projectRooms(next)[0].seats[0].status, 'online');
  assert.equal(projectRooms(next)[0].seats[1].disabled, true);
});

for (const field of ['computerCode', 'serialNumber', 'macAddress', 'ipAddress'] as const) {
  test(`device uniqueness: ${field}`, () => {
    const { state, device } = fixture();
    const next = save(state, device);
    const other = {
      ...device,
      computerCode: 'PC-002',
      serialNumber: 'SN002',
      macAddress: 'AA:BB:CC:DD:EE:02',
      ipAddress: '10.0.1.102',
      seatId: state.seats[1].id,
      [field]: device[field],
    };
    assert.equal(applyRoomAction(next, other).success, false);
  });
}

test('IP, MAC and blank identifiers reject malformed values', () => {
  const { state, device } = fixture();
  for (const ipAddress of ['999.1.1.1', '10.1.1', 'x.y.z.1', '01.1.1.1', '']) {
    assert.equal(applyRoomAction(state, { ...device, ipAddress }).success, false);
  }
  assert.equal(applyRoomAction(state, { ...device, macAddress: 'xyz' }).success, false);
  assert.equal(applyRoomAction(state, { ...device, serialNumber: ' ' }).success, false);
});

test('one computer per seat and moving preserves the device ID and count', () => {
  const { state, device } = fixture();
  const next = save(state, device);
  assert.equal(applyRoomAction(next, { ...device, computerCode: 'PC-002', serialNumber: 'SN002', macAddress: 'AA:BB:CC:DD:EE:02', ipAddress: '10.0.1.102' }).success, false);
  const moved = save(next, { ...device, id: next.computers[0].id, seatId: state.seats[1].id });
  assert.equal(moved.computers.length, 1);
  assert.equal(moved.computers[0].id, next.computers[0].id);
  assert.equal(moved.computers[0].seatId, state.seats[1].id);
  assert.equal(projectRooms(moved)[0].seats[0].machineNo, '');
});

test('invalid Floor/Room/Seat combinations and inactive parents are rejected', () => {
  const { state, device, floorId } = fixture();
  for (const update of [{ floorId: 'missing' }, { roomId: 'missing' }, { seatId: 'missing' }]) {
    assert.equal(applyRoomAction(state, { ...device, ...update }).success, false);
  }
  const inactive = save(state, { type: 'floor', id: floorId, floorNumber: 3, status: 'inactive' });
  assert.equal(applyRoomAction(inactive, device).success, false);
});

test('safe computer unassignment retains registered metadata', () => {
  const { state, device } = fixture();
  const next = save(state, device);
  const unassigned = save(next, { ...device, id: next.computers[0].id, floorId: '', roomId: '', seatId: null });
  assert.equal(unassigned.computers[0].seatId, null);
  assert.equal(unassigned.computers[0].serialNumber, 'SN001');
});

test('exam-room deletion requires no seats or exam references', () => {
  const { state, roomId } = fixture();
  assert.equal(applyRoomAction(state, { type: 'delete', entity: 'rooms', id: roomId }).success, false);
  const cleared = save(state, { type: 'layout', roomId, rows: 0, columns: 0 });
  assert.equal(save(cleared, { type: 'delete', entity: 'rooms', id: roomId }).rooms.length, 0);
  assert.equal(applyRoomAction(cleared, { type: 'delete', entity: 'rooms', id: roomId }, [{ ...initialExamSessions[0], roomId }]).success, false);
});

test('v1 migration creates physical rooms and preserves exam-room, seat and computer IDs', () => {
  const v1 = {
    version: 1 as const,
    floors: [{ id: 'floor_old', floorNumber: 4, status: 'active' as const }],
    rooms: [
      { id: 'room_old_a', floorId: 'floor_old', roomCode: ' b4-01a ', status: 'ready' as const, rows: 1, columns: 1 },
      { id: 'room_old_b', floorId: 'floor_old', roomCode: 'B4-01A', status: 'maintenance' as const, rows: 0, columns: 0 },
    ],
    seats: [{ id: 'seat_old', roomId: 'room_old_a', row: 1, column: 1, seatCode: 'A01', examSeatNo: 'A1' }],
    computers: [{ id: 'computer_old', computerCode: 'PC-OLD', serialNumber: 'SN-OLD', ipAddress: '10.0.0.1', macAddress: 'AA:BB:CC:DD:EE:01', seatId: 'seat_old', status: 'ready' as const }],
  };
  const state = migrateRoomState(v1, []);
  assert.equal(state.version, 2);
  assert.equal(state.physicalRooms.length, 1);
  assert.equal(state.physicalRooms[0].roomCode, 'B4-01A');
  assert.deepEqual(state.rooms.map((room) => room.id), ['room_old_a', 'room_old_b']);
  assert.equal(state.rooms[0].physicalRoomId, state.rooms[1].physicalRoomId);
  assert.deepEqual(state.seats.map((seat) => seat.id), ['seat_old']);
  assert.deepEqual(state.computers.map((computer) => computer.id), ['computer_old']);
});

test('legacy Room[] migration preserves references, runtime statuses and metadata', () => {
  const state = migrateRoomState(null, initialRooms);
  assert.equal(state.floors.length, 2);
  assert.equal(state.physicalRooms.length, state.rooms.length);
  assert.equal(state.computers.length, 64);
  assert.ok(state.computers.every((device) => device.serialNumber === ''));
  for (const room of initialRooms) {
    const projected = projectRooms(state).find((item) => item.id === room.id)!;
    assert.deepEqual(
      projected.seats.map((seat) => [seat.seatNo, seat.machineNo, seat.ip, seat.mac, seat.status]),
      room.seats.map((seat) => [seat.seatNo, seat.machineNo, seat.ip, seat.mac, seat.status]),
    );
  }
  assert.deepEqual(migrateRoomState(JSON.parse(JSON.stringify(state)), []), state);
  assert.ok(!JSON.stringify(state).includes('building'));
});

test('legacy migration deduplicates floors and does not invent unknown floor numbers', () => {
  const state = migrateRoomState(null, [initialRooms[0], { ...initialRooms[1], floor: 3 }]);
  assert.equal(state.floors.length, 1);
  const unknown = migrateRoomState(null, [{ ...initialRooms[0], floor: Number.NaN }]);
  assert.equal(unknown.floors.length, 0);
  assert.equal(unknown.physicalRooms[0].floorId, '');
  assert.equal(projectRooms(unknown)[0].status, 'unavailable');
});

test('existing exam references protect devices, seat history and legacy Serial completion', () => {
  const state = migrateRoomState(null, initialRooms);
  const assignment = initialSeatAssignments[0];
  const exam = initialExamSessions.find((item) => item.id === assignment.examId)!;
  const seat = state.seats.find((item) => item.roomId === exam.roomId && item.examSeatNo === assignment.seatNo)!;
  const device = state.computers.find((item) => item.seatId === seat.id)!;
  assert.equal(applyRoomAction(state, { type: 'delete', entity: 'computers', id: device.id }, initialExamSessions, initialSeatAssignments).success, false);
  const room = state.rooms.find((item) => item.id === seat.roomId)!;
  const path = resolveExamRoom(state, room);
  const edit: RoomAction = { type: 'computer', ...device, floorId: path.floor!.id, roomId: room.id, serialNumber: 'NEW-SERIAL' };
  assert.equal(applyRoomAction(state, edit, initialExamSessions, initialSeatAssignments).success, true);
  assert.equal(applyRoomAction(state, { ...edit, seatId: null, floorId: '', roomId: '' }, initialExamSessions, initialSeatAssignments).success, false);
  const withoutDevices = { ...state, computers: [] };
  assert.equal(applyRoomAction(withoutDevices, { type: 'layout', roomId: room.id, rows: 0, columns: 0 }, initialExamSessions, initialSeatAssignments).success, false);
});
