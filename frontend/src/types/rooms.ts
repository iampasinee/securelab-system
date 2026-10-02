import type { MachineStatus } from '../types';

export type DeviceReadiness = 'ready' | 'maintenance' | 'inactive';
export interface FloorRecord {
  id: string;
  floorNumber: number;
  status: 'active' | 'inactive';
}
export interface PhysicalRoomRecord {
  id: string;
  floorId: string;
  roomCode: string;
  status: 'active' | 'inactive';
}
export interface ExamRoomRecord {
  id: string;
  physicalRoomId: string;
  status: DeviceReadiness;
  rows: number;
  columns: number;
}
export interface RoomSeatRecord {
  id: string;
  roomId: string;
  row: number;
  column: number;
  seatCode: string;
  /** Compatibility with existing exam seat assignments; never rename on resize. */
  examSeatNo: string;
}
export interface ComputerDeviceRecord {
  id: string;
  computerCode: string;
  serialNumber: string;
  ipAddress: string;
  macAddress: string;
  seatId: string | null;
  status: DeviceReadiness;
  /** Runtime simulation state is distinct from registered readiness. */
  machineStatus?: MachineStatus;
}
export interface RoomState {
  version: 2;
  floors: FloorRecord[];
  physicalRooms: PhysicalRoomRecord[];
  rooms: ExamRoomRecord[];
  seats: RoomSeatRecord[];
  computers: ComputerDeviceRecord[];
}
export type RoomAction =
  | { type: 'floor'; id?: string; floorNumber: number; status: FloorRecord['status'] }
  | { type: 'physicalRoom'; id?: string; floorId: string; roomCode: string; status: PhysicalRoomRecord['status'] }
  | { type: 'room'; id?: string; floorId: string; physicalRoomId: string; status: DeviceReadiness }
  | { type: 'layout'; roomId: string; rows: number; columns: number }
  | { type: 'computer'; id?: string; computerCode: string; serialNumber: string; ipAddress: string; macAddress: string; seatId: string | null; floorId: string; roomId: string; status: DeviceReadiness }
  | { type: 'delete'; entity: 'floors' | 'physicalRooms' | 'rooms' | 'computers'; id: string };
export interface RoomActionResult { success: boolean; error?: string; state?: RoomState }
