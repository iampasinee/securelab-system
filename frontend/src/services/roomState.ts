import type { ExamSession, Room, SeatAssignment } from '../types';
import type {
  ExamRoomRecord,
  PhysicalRoomRecord,
  RoomAction,
  RoomActionResult,
  RoomSeatRecord,
  RoomState,
} from '../types/rooms';

export const readinessLabels = { ready: 'พร้อมใช้งาน', maintenance: 'บำรุงรักษา', inactive: 'ปิดใช้งาน' };
export const physicalRoomStatusLabels = { active: 'เปิดใช้งาน', inactive: 'ปิดใช้งาน' };

export function rowLabel(row: number): string {
  let label = '';
  for (let value = row; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + (value - 1) % 26) + label;
  }
  return label;
}

export const seatCode = (row: number, column: number) => `${rowLabel(row)}${String(column).padStart(2, '0')}`;
const newId = (kind: string) => `${kind}_${crypto.randomUUID()}`;
const normalized = (value: string) => value.trim().toUpperCase();
export const normalizeRoomCode = (value: string) => normalized(value).replace(/\s+/g, ' ');
export const normalizeRoomSuffix = (value: string) => normalized(value).replace(/\s+/g, '');

export function generateRoomCodeFromFloor(floorNumber: number, roomSuffix: string): string {
  const suffix = normalizeRoomSuffix(roomSuffix);
  if (!Number.isInteger(floorNumber) || floorNumber < 0 || !/^[A-Z0-9-]+$/.test(suffix)) return '';
  return `B${floorNumber}-${suffix}`;
}

export function getRoomSuffixForFloor(roomCode: string, floorNumber: number): string | null {
  const code = normalizeRoomCode(roomCode);
  const prefix = `B${floorNumber}-`;
  if (!code.startsWith(prefix)) return null;
  const suffix = code.slice(prefix.length);
  return /^[A-Z0-9-]+$/.test(suffix) ? suffix : null;
}

export const normalizeMac = (value: string) => value.trim().replace(/-/g, ':').toUpperCase();
export const validIp = (value: string) => /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value) && value.split('.').every((part) => Number(part) <= 255);

type RoomStateV1 = {
  version: 1;
  floors: RoomState['floors'];
  rooms: Array<Omit<ExamRoomRecord, 'physicalRoomId'> & { floorId: string; roomCode: string }>;
  seats: RoomState['seats'];
  computers: RoomState['computers'];
};

function emptyState(): RoomState {
  return { version: 2, floors: [], physicalRooms: [], rooms: [], seats: [], computers: [] };
}

function physicalRoomFor(state: RoomState, floorId: string, roomCode: string, idHint?: string): PhysicalRoomRecord {
  const code = normalizeRoomCode(roomCode) || 'ยังไม่ระบุ';
  const existing = state.physicalRooms.find((room) => room.floorId === floorId && normalized(room.roomCode) === normalized(code));
  if (existing) return existing;
  const record: PhysicalRoomRecord = {
    id: idHint || newId('physical_room'),
    floorId,
    roomCode: code,
    status: floorId ? 'active' : 'inactive',
  };
  state.physicalRooms.push(record);
  return record;
}

/** Version 2 is authoritative. Version 1 and the older Room[] storage are forward-migrated without changing dependent IDs. */
export function migrateRoomState(saved: unknown, legacy: Room[]): RoomState {
  const candidate = saved as Partial<RoomState> | RoomStateV1 | null;
  if (candidate?.version === 2 && Array.isArray(candidate.physicalRooms)) return candidate as RoomState;
  if (candidate?.version === 1 && Array.isArray(candidate.rooms)) {
    const old = candidate as RoomStateV1;
    const state: RoomState = {
      version: 2,
      floors: structuredClone(old.floors),
      physicalRooms: [],
      rooms: [],
      seats: structuredClone(old.seats),
      computers: structuredClone(old.computers),
    };
    for (const room of old.rooms) {
      const physical = physicalRoomFor(state, room.floorId, room.roomCode, `physical_${room.id}`);
      const { floorId: _floorId, roomCode: _roomCode, ...rest } = room;
      state.rooms.push({ ...rest, physicalRoomId: physical.id });
    }
    return state;
  }

  const state = emptyState();
  for (const room of legacy) {
    const floorNumber = Number(String(room.floor).replace(/^ชั้น\s*/, '').trim());
    const validFloor = Number.isInteger(floorNumber) && floorNumber >= 0 && String(room.floor).trim() !== '';
    const floorId = validFloor ? `floor_legacy_${floorNumber}` : '';
    if (validFloor && !state.floors.some((floor) => floor.id === floorId)) state.floors.push({ id: floorId, floorNumber, status: 'active' });
    const physical = physicalRoomFor(state, floorId, room.labName, `physical_${room.id}`);
    const record: ExamRoomRecord = {
      id: room.id,
      physicalRoomId: physical.id,
      status: room.status === 'unavailable' ? 'inactive' : room.status,
      rows: room.rows,
      columns: room.columns,
    };
    state.rooms.push(record);
    for (const [index, binding] of room.seats.entries()) {
      const match = /^([A-Z]+)0*([1-9]\d*)$/i.exec(binding.seatNo);
      const row = match ? [...match[1].toUpperCase()].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0) : Math.floor(index / Math.max(room.columns, 1)) + 1;
      const column = match ? Number(match[2]) : index % Math.max(room.columns, 1) + 1;
      const seat: RoomSeatRecord = {
        id: `seat_legacy_${room.id}_${index}`,
        roomId: room.id,
        row,
        column,
        seatCode: seatCode(row, column),
        examSeatNo: binding.seatNo,
      };
      state.seats.push(seat);
      record.rows = Math.max(record.rows, row);
      record.columns = Math.max(record.columns, column);
      if (binding.machineNo || binding.ip || binding.mac) state.computers.push({
        id: `computer_legacy_${room.id}_${index}`,
        computerCode: binding.machineNo,
        serialNumber: '',
        ipAddress: binding.ip,
        macAddress: normalizeMac(binding.mac),
        seatId: seat.id,
        status: binding.status === 'damaged' ? 'maintenance' : binding.disabled || binding.status === 'unavailable' ? 'inactive' : 'ready',
        machineStatus: binding.status,
      });
    }
  }
  return state;
}

export function resolveExamRoom(state: RoomState, room: ExamRoomRecord) {
  const physicalRoom = state.physicalRooms.find((item) => item.id === room.physicalRoomId);
  const floor = state.floors.find((item) => item.id === physicalRoom?.floorId);
  return { physicalRoom, floor };
}

/** Read-only adapter for existing Teacher/Student flows, never persisted. */
export function projectRooms(state: RoomState): Room[] {
  return state.rooms.map((room) => {
    const { physicalRoom, floor } = resolveExamRoom(state, room);
    const available = room.status === 'ready' && physicalRoom?.status === 'active' && floor?.status === 'active';
    return {
      id: room.id,
      building: '',
      floor: floor?.floorNumber ?? 0,
      labName: physicalRoom?.roomCode || 'ยังไม่ระบุห้อง',
      status: !available ? room.status === 'maintenance' ? 'maintenance' : 'unavailable' : 'ready',
      rows: room.rows,
      columns: room.columns,
      deskOrientation: 'front',
      seats: state.seats.filter((seat) => seat.roomId === room.id).map((seat) => {
        const computer = state.computers.find((item) => item.seatId === seat.id);
        const status = !available || !computer || computer.status === 'inactive' ? 'unavailable' : computer.status === 'maintenance' ? 'damaged' : computer.machineStatus || 'online';
        return { seatNo: seat.examSeatNo, machineNo: computer?.computerCode || '', ip: computer?.ipAddress || '', mac: computer?.macAddress || '', status, disabled: !available || !computer || computer.status !== 'ready' };
      }),
    };
  });
}

export function seatHasExamReference(state: RoomState, seatId: string, exams: ExamSession[], assignments: SeatAssignment[]): boolean {
  const seat = state.seats.find((item) => item.id === seatId);
  return Boolean(seat && exams.some((exam) => exam.roomId === seat.roomId && assignments.some((item) => item.examId === exam.id && item.seatNo === seat.examSeatNo)));
}

export function applyRoomAction(state: RoomState, action: RoomAction, exams: ExamSession[] = [], assignments: SeatAssignment[] = []): RoomActionResult {
  const fail = (error: string): RoomActionResult => ({ success: false, error });
  const next = structuredClone(state);
  const activeRoom = (roomId: string) => {
    const room = state.rooms.find((item) => item.id === roomId);
    if (!room) return false;
    const { physicalRoom, floor } = resolveExamRoom(state, room);
    return room.status === 'ready' && physicalRoom?.status === 'active' && floor?.status === 'active';
  };

  if (action.type === 'floor') {
    if (action.id && !state.floors.some((item) => item.id === action.id)) return fail('ไม่พบชั้น');
    if (!Number.isInteger(action.floorNumber) || action.floorNumber < 0 || action.floorNumber > 200) return fail('หมายเลขชั้นต้องเป็นจำนวนเต็ม 0–200');
    if (!['active', 'inactive'].includes(action.status)) return fail('สถานะชั้นไม่ถูกต้อง');
    if (state.floors.some((item) => item.id !== action.id && item.floorNumber === action.floorNumber)) return fail('มีหมายเลขชั้นนี้แล้ว');
    const record = { id: action.id || newId('floor'), floorNumber: action.floorNumber, status: action.status };
    next.floors = [...next.floors.filter((item) => item.id !== record.id), record];
  } else if (action.type === 'physicalRoom') {
    const old = state.physicalRooms.find((item) => item.id === action.id);
    if (action.id && !old) return fail('ไม่พบห้องในชั้น');
    const floor = state.floors.find((item) => item.id === action.floorId);
    if (!floor || (floor.status !== 'active' && old?.floorId !== floor.id)) return fail('กรุณาเลือกชั้นที่เปิดใช้งาน');
    const roomCode = normalizeRoomCode(action.roomCode);
    if (!roomCode || roomCode.length > 80) return fail('รหัสห้องต้องมี 1–80 ตัวอักษร');
    const keepsLegacyCode = Boolean(old && normalizeRoomCode(old.roomCode) === roomCode);
    if (!keepsLegacyCode && getRoomSuffixForFloor(roomCode, floor.floorNumber) === null) return fail('รหัสห้องใหม่ต้องสร้างจากหมายเลขชั้นและรหัสย่อย/เลขห้อง');
    if (!['active', 'inactive'].includes(action.status)) return fail('สถานะห้องในชั้นไม่ถูกต้อง');
    if (state.physicalRooms.some((room) => room.id !== action.id && room.floorId === floor.id && normalized(room.roomCode) === normalized(roomCode))) return fail('มีรหัสห้องนี้ในชั้นที่เลือกแล้ว');
    if (old && old.floorId !== floor.id && state.rooms.some((room) => room.physicalRoomId === old.id)) return fail('ไม่สามารถย้ายห้องที่เปิดเป็นห้องสอบแล้วไปยังชั้นอื่นได้');
    const record = { id: action.id || newId('physical_room'), floorId: floor.id, roomCode, status: action.status };
    next.physicalRooms = [...next.physicalRooms.filter((item) => item.id !== record.id), record];
  } else if (action.type === 'room') {
    const old = state.rooms.find((item) => item.id === action.id);
    if (action.id && !old) return fail('ไม่พบห้องสอบ');
    const floor = state.floors.find((item) => item.id === action.floorId);
    const physicalRoom = state.physicalRooms.find((item) => item.id === action.physicalRoomId);
    if (!floor || !physicalRoom || physicalRoom.floorId !== floor.id) return fail('ชั้นและห้องที่เลือกไม่สัมพันธ์กัน');
    if ((!old || old.physicalRoomId !== physicalRoom.id) && (floor.status !== 'active' || physicalRoom.status !== 'active')) return fail('ห้องหรือชั้นนี้ปิดใช้งาน ไม่สามารถเปิดเป็นห้องสอบได้');
    if (state.rooms.some((room) => room.id !== action.id && room.physicalRoomId === physicalRoom.id)) return fail('ห้องนี้ถูกเปิดเป็นห้องสอบแล้ว');
    if (!Object.hasOwn(readinessLabels, action.status)) return fail('สถานะห้องสอบไม่ถูกต้อง');
    const hasDependents = Boolean(old && (state.seats.some((seat) => seat.roomId === old.id) || exams.some((exam) => exam.roomId === old.id)));
    if (old && old.physicalRoomId !== physicalRoom.id && hasDependents) return fail('ไม่สามารถเปลี่ยนห้องจริงได้ เนื่องจากห้องสอบนี้มีผังหรือประวัติการสอบอ้างอิง');
    const record = { id: action.id || newId('room'), physicalRoomId: physicalRoom.id, status: action.status, rows: old?.rows || 0, columns: old?.columns || 0 };
    next.rooms = [...next.rooms.filter((item) => item.id !== record.id), record];
  } else if (action.type === 'layout') {
    const room = next.rooms.find((item) => item.id === action.roomId);
    if (!room || !activeRoom(room.id)) return fail('กรุณาเลือกห้องสอบที่พร้อมใช้งาน');
    if (![action.rows, action.columns].every((number) => Number.isInteger(number) && number >= 0 && number <= 100) || action.rows * action.columns > 1000 || ((action.rows === 0) !== (action.columns === 0))) return fail('กำหนดผัง 1–100 แถว/คอลัมน์ รวมไม่เกิน 1,000 ที่นั่ง หรือ 0 × 0 เพื่อล้างผัง');
    const removed = state.seats.filter((seat) => seat.roomId === room.id && (seat.row > action.rows || seat.column > action.columns));
    if (removed.some((seat) => state.computers.some((device) => device.seatId === seat.id))) return fail('ไม่สามารถลดขนาดผังห้องได้ เนื่องจากมีเครื่องคอมพิวเตอร์ผูกกับที่นั่งที่จะถูกลบ กรุณาย้ายหรือนำเครื่องออกก่อน');
    if (removed.some((seat) => seatHasExamReference(state, seat.id, exams, assignments))) return fail('ไม่สามารถลบที่นั่งที่มีประวัติการจัดสอบอ้างอิง');
    next.seats = next.seats.filter((seat) => !removed.some((item) => item.id === seat.id));
    for (let row = 1; row <= action.rows; row++) for (let column = 1; column <= action.columns; column++) {
      if (!next.seats.some((seat) => seat.roomId === room.id && seat.row === row && seat.column === column)) next.seats.push({ id: newId('seat'), roomId: room.id, row, column, seatCode: seatCode(row, column), examSeatNo: `${rowLabel(row)}${column}` });
    }
    room.rows = action.rows;
    room.columns = action.columns;
  } else if (action.type === 'computer') {
    const old = state.computers.find((item) => item.id === action.id);
    if (action.id && !old) return fail('ไม่พบเครื่องคอมพิวเตอร์');
    const values = { computerCode: action.computerCode.trim(), serialNumber: action.serialNumber.trim(), ipAddress: action.ipAddress.trim(), macAddress: normalizeMac(action.macAddress) };
    if (!values.computerCode || !values.serialNumber || values.computerCode.length > 80 || values.serialNumber.length > 120) return fail('กรุณาระบุหมายเลขเครื่องและ Serial Number ให้ครบถ้วน');
    if (!validIp(values.ipAddress)) return fail('IP Address ไม่ถูกต้อง กรุณาระบุ IPv4');
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(values.macAddress)) return fail('MAC Address ไม่ถูกต้อง');
    for (const key of ['computerCode', 'serialNumber', 'ipAddress', 'macAddress'] as const) {
      if (state.computers.some((item) => item.id !== action.id && normalized(key === 'macAddress' ? normalizeMac(item[key]) : item[key]) === normalized(values[key]))) return fail(`${({ computerCode: 'หมายเลขเครื่อง', serialNumber: 'Serial Number', ipAddress: 'IP Address', macAddress: 'MAC Address' })[key]} ซ้ำในระบบ`);
    }
    if (!Object.hasOwn(readinessLabels, action.status)) return fail('สถานะเครื่องไม่ถูกต้อง');
    if (action.seatId) {
      const seat = state.seats.find((item) => item.id === action.seatId);
      const room = state.rooms.find((item) => item.id === seat?.roomId);
      const path = room ? resolveExamRoom(state, room) : undefined;
      if (!seat || !room || !path.floor || seat.roomId !== action.roomId || path.floor.id !== action.floorId) return fail('ชั้น ห้อง และที่นั่งไม่สัมพันธ์กัน');
      if (!activeRoom(room.id) && old?.seatId !== seat.id) return fail('ห้องหรือชั้นนี้ไม่พร้อมสำหรับการกำหนดเครื่องใหม่');
      if (state.computers.some((item) => item.id !== action.id && item.seatId === action.seatId)) return fail('ที่นั่งนี้มีเครื่องคอมพิวเตอร์แล้ว');
    } else if (!old) return fail('กรุณาเลือกที่นั่งสำหรับเครื่องใหม่');
    else if (action.floorId || action.roomId) return fail('กรุณาเลือกที่นั่ง หรือนำเครื่องออกจากที่นั่งอย่างชัดเจน');
    if (old?.seatId && seatHasExamReference(state, old.seatId, exams, assignments) && (old.seatId !== action.seatId || Object.keys(values).some((key) => {
      if (key === 'serialNumber' && !old.serialNumber) return false;
      return values[key as keyof typeof values] !== old[key as keyof typeof values];
    }))) return fail('เครื่องนี้มีประวัติการจัดสอบอ้างอิง ไม่สามารถย้ายหรือเปลี่ยนข้อมูลประจำเครื่องได้');
    const record = { ...values, id: action.id || newId('computer'), seatId: action.seatId, status: action.status, machineStatus: old?.status === action.status ? old.machineStatus : undefined };
    next.computers = [...next.computers.filter((item) => item.id !== record.id), record];
  } else {
    if (!state[action.entity].some((item) => item.id === action.id)) return fail('ไม่พบข้อมูล');
    if (action.entity === 'floors') {
      if (state.physicalRooms.some((room) => room.floorId === action.id)) return fail('ไม่สามารถลบชั้นที่มีห้องในชั้นอ้างอิง');
      next.floors = next.floors.filter((item) => item.id !== action.id);
    } else if (action.entity === 'physicalRooms') {
      if (state.rooms.some((room) => room.physicalRoomId === action.id)) return fail('ไม่สามารถลบห้องในชั้นที่เปิดเป็นห้องสอบแล้ว กรุณาปิดใช้งานแทน');
      next.physicalRooms = next.physicalRooms.filter((item) => item.id !== action.id);
    } else if (action.entity === 'rooms') {
      if (state.seats.some((seat) => seat.roomId === action.id) || exams.some((exam) => exam.roomId === action.id)) return fail('ไม่สามารถลบห้องสอบที่มีที่นั่งหรือประวัติการสอบอ้างอิง กรุณาปิดใช้งานแทน');
      next.rooms = next.rooms.filter((item) => item.id !== action.id);
    } else {
      const device = state.computers.find((item) => item.id === action.id)!;
      if (device.seatId && seatHasExamReference(state, device.seatId, exams, assignments)) return fail('ไม่สามารถลบเครื่องที่มีประวัติการจัดสอบอ้างอิง');
      next.computers = next.computers.filter((item) => item.id !== action.id);
    }
  }
  return { success: true, state: next };
}
