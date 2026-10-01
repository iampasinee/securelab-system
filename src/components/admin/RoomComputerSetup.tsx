import React, { useId, useState } from 'react';
import { Ellipsis, Eye, Monitor, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  generateRoomCodeFromFloor,
  getRoomSuffixForFloor,
  physicalRoomStatusLabels,
  readinessLabels,
  resolveExamRoom,
} from '../../services/roomState';
import type { DeviceReadiness, PhysicalRoomRecord, RoomAction } from '../../types/rooms';
import { Modal } from '../common/Modal';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40';
const primaryClass = `${buttonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`;
type EditorKind = 'floor' | 'physicalRoom' | 'room' | 'computer';
const emptyForm = { floorNumber: '', floorId: '', physicalRoomId: '', roomId: '', seatId: '', roomCode: '', roomSuffix: '', computerCode: '', serialNumber: '', ipAddress: '', macAddress: '', status: 'ready' };

function Field({ label, children }: { key?: React.Key; label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="space-y-1 text-xs font-semibold text-slate-700"><label htmlFor={id} className="block">{label}</label>{React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })}</div>;
}

function Status({ status }: { status: DeviceReadiness }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[11px] ${status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'maintenance' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{readinessLabels[status]}</span>;
}

function DataTable({ headings, children, emptyMessage }: { headings: string[]; children: React.ReactNode; emptyMessage?: string }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-xs [&_td]:px-4 [&_td]:py-3"><thead className="bg-slate-50 text-slate-500"><tr>{headings.map((label) => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}{emptyMessage && <tr><td colSpan={headings.length} className="h-28 text-center text-slate-500">{emptyMessage}</td></tr>}</tbody></table></div>;
}

export const RoomComputerSetup: React.FC = () => {
  const { roomState: state, manageRooms, activeAdminRoute, examSessions } = useApp();
  const [tab, setTab] = useState<'rooms' | 'layout' | 'computers'>(activeAdminRoute === 'A5' ? 'computers' : 'rooms');
  const [floorId, setFloorId] = useState('');
  const [selectedPhysicalRoomId, setSelectedPhysicalRoomId] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [openingStatus, setOpeningStatus] = useState('');
  const [editor, setEditor] = useState<{ kind: EditorKind; id?: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Extract<RoomAction, { type: 'delete' }> | null>(null);
  const [detail, setDetail] = useState<{ kind: 'physicalRoom' | 'computer'; id: string } | null>(null);
  const [dimensions, setDimensions] = useState({ rows: 5, columns: 8 });
  const [layoutError, setLayoutError] = useState('');
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const selectedPhysicalRoom = state.physicalRooms.find((room) => room.id === selectedPhysicalRoomId);
  const selectedRoom = state.rooms.find((room) => room.physicalRoomId === selectedPhysicalRoomId);
  const roomSeats = (id: string) => state.seats.filter((seat) => seat.roomId === id);
  const roomComputers = (id: string) => state.computers.filter((device) => state.seats.some((seat) => seat.id === device.seatId && seat.roomId === id));
  const floorText = (id?: string) => {
    const floor = state.floors.find((item) => item.id === id);
    return floor ? `ชั้น ${floor.floorNumber}` : 'ยังไม่กำหนดชั้น';
  };
  const devicePath = (seatId: string | null) => {
    const seat = state.seats.find((item) => item.id === seatId);
    const room = state.rooms.find((item) => item.id === seat?.roomId);
    return { seat, room, ...(room ? resolveExamRoom(state, room) : {}) };
  };
  const changeFloor = (id: string) => {
    setFloorId(id);
    setSelectedPhysicalRoomId('');
    setLayoutError('');
    setIsEditingLayout(false);
  };
  const changeRoom = (physicalRoomId: string) => {
    setSelectedPhysicalRoomId(physicalRoomId);
    setLayoutError('');
    setIsEditingLayout(false);
    const room = state.rooms.find((item) => item.physicalRoomId === physicalRoomId);
    setDimensions({ rows: room?.rows || 5, columns: room?.columns || 8 });
  };
  const showRoomLayout = (physicalRoom: PhysicalRoomRecord) => {
    setFloorId(physicalRoom.floorId);
    changeRoom(physicalRoom.id);
    setTab('layout');
    setSearch('');
    setStatus('');
    setOpeningStatus('');
  };
  const cancelLayoutEdit = () => {
    setDimensions({ rows: selectedRoom?.rows || 5, columns: selectedRoom?.columns || 8 });
    setLayoutError('');
    setIsEditingLayout(false);
  };
  const submitLayout = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRoom) return;
    const result = manageRooms({ type: 'layout', roomId: selectedRoom.id, ...dimensions });
    setLayoutError(result.error || '');
    if (result.success) setIsEditingLayout(false);
  };
  const roomHasDependents = (id?: string) => Boolean(id && (state.seats.some((seat) => seat.roomId === id) || examSessions.some((exam) => exam.roomId === id)));

  const openEditor = (kind: EditorKind, id?: string, seatId?: string) => {
    setError('');
    setEditor({ kind, id });
    const floor = state.floors.find((item) => item.id === id);
    const physicalRoom = state.physicalRooms.find((item) => item.id === id);
    const physicalFloor = state.floors.find((item) => item.id === physicalRoom?.floorId);
    const examRoom = state.rooms.find((item) => item.id === id);
    const examRoomPath = examRoom ? resolveExamRoom(state, examRoom) : undefined;
    const device = state.computers.find((item) => item.id === id);
    const seat = state.seats.find((item) => item.id === (seatId || device?.seatId));
    const deviceRoom = state.rooms.find((item) => item.id === seat?.roomId);
    const deviceRoomPath = deviceRoom ? resolveExamRoom(state, deviceRoom) : undefined;
    setForm({
      ...emptyForm,
      floorNumber: floor ? String(floor.floorNumber) : '',
      floorId: physicalRoom?.floorId || examRoomPath?.floor?.id || deviceRoomPath?.floor?.id || floorId,
      physicalRoomId: examRoom?.physicalRoomId || '',
      roomId: deviceRoom?.id || '',
      seatId: seat?.id || '',
      roomCode: physicalRoom?.roomCode || '',
      roomSuffix: physicalRoom && physicalFloor ? getRoomSuffixForFloor(physicalRoom.roomCode, physicalFloor.floorNumber) || '' : '',
      computerCode: device?.computerCode || '',
      serialNumber: device?.serialNumber || '',
      ipAddress: device?.ipAddress || '',
      macAddress: device?.macAddress || '',
      status: kind === 'floor' ? floor?.status || 'active' : kind === 'physicalRoom' ? physicalRoom?.status || 'active' : kind === 'room' ? examRoom?.status || 'ready' : device?.status || 'ready',
    });
  };

  const openAsExamRoom = (physicalRoom: PhysicalRoomRecord) => {
    setError('');
    setEditor({ kind: 'room' });
    setForm({
      ...emptyForm,
      floorId: physicalRoom.floorId,
      physicalRoomId: physicalRoom.id,
      status: 'ready',
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    const common = { id: editor.id, status: form.status as DeviceReadiness };
    const formFloor = state.floors.find((floor) => floor.id === form.floorId);
    const existingPhysicalRoom = state.physicalRooms.find((room) => room.id === editor.id);
    const generatedRoomCode = formFloor ? generateRoomCodeFromFloor(formFloor.floorNumber, form.roomSuffix) : '';
    if (editor.kind === 'physicalRoom' && form.roomSuffix && !generatedRoomCode) {
      setError('รหัสย่อย/เลขห้องใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และเครื่องหมายขีดกลาง');
      return;
    }
    if (editor.kind === 'physicalRoom' && !generatedRoomCode && (!existingPhysicalRoom || existingPhysicalRoom.floorId !== form.floorId)) {
      setError('กรุณาระบุรหัสย่อย/เลขห้อง');
      return;
    }
    const action: RoomAction = editor.kind === 'floor'
      ? { type: 'floor', id: editor.id, floorNumber: Number(form.floorNumber), status: form.status as 'active' | 'inactive' }
      : editor.kind === 'physicalRoom'
        ? { type: 'physicalRoom', id: editor.id, floorId: form.floorId, roomCode: generatedRoomCode || form.roomCode, status: form.status as 'active' | 'inactive' }
        : editor.kind === 'room'
          ? { ...common, type: 'room', floorId: form.floorId, physicalRoomId: form.physicalRoomId }
          : { ...common, type: 'computer', floorId: form.floorId, roomId: form.roomId, seatId: form.seatId || null, computerCode: form.computerCode, serialNumber: form.serialNumber, ipAddress: form.ipAddress, macAddress: form.macAddress };
    const result = manageRooms(action);
    if (result.success) {
      setEditor(null);
      if (editor.kind === 'room' && form.physicalRoomId) {
        setFloorId(form.floorId);
        setSelectedPhysicalRoomId(form.physicalRoomId);
        setDimensions({
          rows: currentExamRoom?.rows || 5,
          columns: currentExamRoom?.columns || 8,
        });
        setIsEditingLayout(false);
        setTab('layout');
      }
    } else {
      setError(result.error || 'บันทึกไม่สำเร็จ');
    }
  };

  const remove = (entity: Extract<RoomAction, { type: 'delete' }>['entity'], id: string) => {
    setError('');
    setConfirm({ type: 'delete', entity, id });
  };
  const filteredPhysicalRooms = state.physicalRooms.filter((physicalRoom) => {
    const examRoom = state.rooms.find((room) => room.physicalRoomId === physicalRoom.id);
    const matchesOpeningStatus = !openingStatus || (openingStatus === 'opened' ? Boolean(examRoom) : !examRoom);
    return (!floorId || physicalRoom.floorId === floorId)
      && (!status || physicalRoom.status === status)
      && matchesOpeningStatus
      && physicalRoom.roomCode.toLowerCase().includes(search.trim().toLowerCase());
  });
  const filteredComputers = state.computers.filter((device) => {
    const path = devicePath(device.seatId);
    return (!floorId || path.floor?.id === floorId) && (!selectedPhysicalRoomId || path.physicalRoom?.id === selectedPhysicalRoomId) && (!status || device.status === status) && [device.computerCode, device.serialNumber, device.ipAddress, device.macAddress].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()));
  });
  const currentExamRoom = state.rooms.find((room) => room.id === editor?.id);
  const roomRelationshipLocked = editor?.kind === 'room' && roomHasDependents(editor.id);
  const physicalFloorLocked = editor?.kind === 'physicalRoom' && Boolean(editor.id && state.rooms.some((room) => room.physicalRoomId === editor.id));
  const editingPhysicalRoom = editor?.kind === 'physicalRoom' ? state.physicalRooms.find((room) => room.id === editor.id) : undefined;
  const editingPhysicalFloor = state.floors.find((floor) => floor.id === editingPhysicalRoom?.floorId);
  const legacyPhysicalCode = Boolean(editingPhysicalRoom && editingPhysicalFloor && getRoomSuffixForFloor(editingPhysicalRoom.roomCode, editingPhysicalFloor.floorNumber) === null);
  const selectedFormFloor = state.floors.find((floor) => floor.id === form.floorId);
  const generatedRoomCode = selectedFormFloor ? generateRoomCodeFromFloor(selectedFormFloor.floorNumber, form.roomSuffix) : '';
  const roomCodePreview = generatedRoomCode || (legacyPhysicalCode && editingPhysicalRoom?.floorId === form.floorId ? form.roomCode : '');
  const currentDevice = state.computers.find((device) => device.id === editor?.id);
  const currentDevicePath = devicePath(currentDevice?.seatId || null);
  const availablePhysicalRooms = state.physicalRooms.filter((physical) => physical.floorId === form.floorId);
  const formRooms = state.rooms.filter((room) => {
    const path = resolveExamRoom(state, room);
    return path.floor?.id === form.floorId && (room.status === 'ready' || room.id === currentDevicePath.room?.id);
  });
  const formSeats = state.seats.filter((seat) => seat.roomId === form.roomId && !state.computers.some((device) => device.seatId === seat.id && device.id !== editor?.id));

  const computerActions = (id: string) => <div className="flex justify-end gap-1">
    {[{ label: 'ดูรายละเอียด', icon: Eye, run: () => setDetail({ kind: 'computer' as const, id }) }, { label: 'แก้ไข', icon: Pencil, run: () => openEditor('computer', id) }, { label: 'ลบ', icon: Trash2, run: () => remove('computers', id) }].map(({ label, icon: Icon, run }) => <button key={label} type="button" title={label} aria-label={label} onClick={run} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"><Icon className="h-4 w-4" /></button>)}
  </div>;

  return <div className="space-y-5 text-left">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
      <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Monitor className="h-9 w-9 rounded-xl bg-blue-600 p-2 text-white" />ห้องสอบและเครื่องคอมพิวเตอร์</h1><p className="mt-2 text-xs text-slate-500">จัดการชั้น ห้องในชั้น ห้องสอบ ผังที่นั่ง และเครื่องคอมพิวเตอร์สำหรับการสอบ</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => openEditor('floor')} className={buttonClass}><Plus size={16} />เพิ่มชั้น</button>{tab === 'rooms' && <button onClick={() => openEditor('physicalRoom')} className={buttonClass}><Plus size={16} />เพิ่มห้องในชั้น</button>}<button onClick={() => openEditor(tab === 'computers' ? 'computer' : 'room')} className={primaryClass}><Plus size={16} />{tab === 'computers' ? 'เพิ่มเครื่องคอมพิวเตอร์' : 'เพิ่มห้องสอบ'}</button></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['ชั้นทั้งหมด', state.floors.length],
      ['ห้องในชั้นทั้งหมด', state.physicalRooms.length],
      ['ห้องสอบทั้งหมด', state.rooms.length],
      ['เครื่องคอมพิวเตอร์ทั้งหมด', state.computers.length],
    ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-blue-700">{value}</p></div>)}</div>

    <div role="tablist" aria-label="จัดการห้องสอบ" className="flex flex-wrap gap-1 border-b border-slate-200">{([{ id: 'rooms', label: 'ห้องสอบ' }, { id: 'layout', label: 'ผังที่นั่งและเครื่อง' }, { id: 'computers', label: 'เครื่องคอมพิวเตอร์' }] as const).map(({ id, label }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setSearch(''); setStatus(''); setOpeningStatus(''); }} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>{label}</button>)}</div>

    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      {tab !== 'layout' && <div className="min-w-48 flex-1"><Field label="ค้นหา"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'rooms' ? 'ค้นหารหัสห้อง...' : 'หมายเลขเครื่อง / Serial Number / IP Address / MAC Address'} className={inputClass} /></Field></div>}
      <div className="min-w-40 flex-1 sm:flex-none"><Field label="ชั้น"><select value={floorId} onChange={(event) => changeFloor(event.target.value)} className={inputClass}><option value="">{tab === 'layout' ? 'เลือกชั้น' : 'ทุกชั้น'}</option>{state.floors.map((floor) => <option key={floor.id} value={floor.id}>ชั้น {floor.floorNumber}{floor.status === 'inactive' ? ' (ปิดใช้งาน)' : ''}</option>)}</select></Field></div>
      {tab !== 'rooms' && <div className="min-w-40 flex-1 sm:flex-none"><Field label={tab === 'layout' ? 'ห้อง' : 'ห้องสอบ'}><select disabled={!floorId} value={selectedPhysicalRoomId} onChange={(event) => changeRoom(event.target.value)} className={inputClass}><option value="">{tab === 'layout' ? 'เลือกห้อง' : 'ทุกห้องสอบ'}</option>{state.physicalRooms.filter((physicalRoom) => physicalRoom.floorId === floorId && (tab === 'layout' || state.rooms.some((room) => room.physicalRoomId === physicalRoom.id))).map((physicalRoom) => <option key={physicalRoom.id} value={physicalRoom.id}>{physicalRoom.roomCode}{tab === 'layout' && !state.rooms.some((room) => room.physicalRoomId === physicalRoom.id) ? ' — ยังไม่เปิดเป็นห้องสอบ' : ''}</option>)}</select></Field></div>}
      {tab !== 'layout' && <div className="min-w-40 flex-1 sm:flex-none"><Field label={tab === 'rooms' ? 'สถานะห้อง' : 'สถานะ'}><select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="">ทุกสถานะ</option>{Object.entries(tab === 'rooms' ? physicalRoomStatusLabels : readinessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>}
      {tab === 'rooms' && <div className="min-w-52 flex-1 sm:flex-none"><Field label="สถานะการเปิดเป็นห้องสอบ"><select value={openingStatus} onChange={(event) => setOpeningStatus(event.target.value)} className={inputClass}><option value="">ทั้งหมด</option><option value="opened">เปิดเป็นห้องสอบแล้ว</option><option value="unopened">ยังไม่ได้เปิดเป็นห้องสอบ</option></select></Field></div>}
      <button className={buttonClass} onClick={() => { changeFloor(''); setSearch(''); setStatus(''); setOpeningStatus(''); }}>ล้างตัวกรอง</button>
    </div>

    {tab === 'rooms' && <DataTable headings={['รหัสห้อง', 'ชั้น', 'สถานะห้อง', 'สถานะการเปิดเป็นห้องสอบ', 'ผังห้อง', 'จำนวนที่นั่ง', 'จำนวนเครื่อง', 'การดำเนินการ']} emptyMessage={!filteredPhysicalRooms.length ? state.physicalRooms.length ? 'ไม่พบห้องที่ตรงกับตัวกรอง' : 'ยังไม่มีห้องในระบบ' : undefined}>{filteredPhysicalRooms.map((physicalRoom) => {
      const floor = state.floors.find((item) => item.id === physicalRoom.floorId);
      const examRoom = state.rooms.find((room) => room.physicalRoomId === physicalRoom.id);
      return <tr key={physicalRoom.id}>
        <td>
          <button
            type="button"
            aria-label={`เปิดผังห้อง ${physicalRoom.roomCode}`}
            onClick={() => showRoomLayout(physicalRoom)}
            className="rounded-md font-bold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900 hover:decoration-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {physicalRoom.roomCode}
          </button>
        </td>
        <td>{floorText(floor?.id)}</td>
        <td><span className={`inline-flex rounded-full border px-2 py-1 text-[11px] ${physicalRoom.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{physicalRoomStatusLabels[physicalRoom.status]}</span></td>
        <td>{examRoom ? <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700">เปิดเป็นห้องสอบแล้ว</span> : <span className="text-slate-500">ยังไม่ได้เปิดเป็นห้องสอบ</span>}</td>
        <td>{examRoom ? <button type="button" className="text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => showRoomLayout(physicalRoom)}>{examRoom.rows} × {examRoom.columns}</button> : '—'}</td>
        <td>{examRoom ? roomSeats(examRoom.id).length : '—'}</td>
        <td>{examRoom ? roomComputers(examRoom.id).length : '—'}</td>
        <td>
          <div className="flex min-w-max items-center justify-end gap-2">
            <button type="button" onClick={() => setDetail({ kind: 'physicalRoom', id: physicalRoom.id })} className={buttonClass}>ดูรายละเอียด</button>
            {examRoom ? (
              <button type="button" onClick={() => showRoomLayout(physicalRoom)} className={primaryClass}>จัดการห้องสอบ</button>
            ) : (
              <button type="button" disabled={physicalRoom.status !== 'active' || floor?.status !== 'active'} onClick={() => openAsExamRoom(physicalRoom)} className={primaryClass}>เปิดเป็นห้องสอบ</button>
            )}
            <details className="group relative">
              <summary role="button" aria-haspopup="menu" aria-label={`เมนูเพิ่มเติมสำหรับห้อง ${physicalRoom.roomCode}`} className="flex min-h-9 min-w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"><Ellipsis className="h-4 w-4" /></summary>
              <div role="menu" className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <button type="button" role="menuitem" onClick={() => openEditor('physicalRoom', physicalRoom.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"><Pencil className="h-4 w-4" />แก้ไขห้อง</button>
                {examRoom && <button type="button" role="menuitem" onClick={() => openEditor('room', examRoom.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"><Monitor className="h-4 w-4" />แก้ไขสถานะห้องสอบ</button>}
                {examRoom && <button type="button" role="menuitem" onClick={() => remove('rooms', examRoom.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600"><Monitor className="h-4 w-4" />นำออกจากห้องสอบ</button>}
                <button type="button" role="menuitem" onClick={() => remove('physicalRooms', physicalRoom.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"><Trash2 className="h-4 w-4" />ลบห้อง</button>
              </div>
            </details>
          </div>
        </td>
      </tr>;
    })}</DataTable>}

    {tab === 'layout' && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      {!selectedPhysicalRoom ? (
        <p className="p-8 text-center text-sm text-slate-500">เลือกชั้นและห้องเพื่อดูหรือจัดการผังที่นั่ง</p>
      ) : !selectedRoom ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <div>
            <p className="text-base font-bold text-slate-900">{selectedPhysicalRoom.roomCode}</p>
            <p className="mt-1 text-sm text-slate-600">ห้องนี้ยังไม่ได้เปิดเป็นห้องสอบ</p>
          </div>
          <button
            type="button"
            disabled={selectedPhysicalRoom.status !== 'active' || state.floors.find((floor) => floor.id === selectedPhysicalRoom.floorId)?.status !== 'active'}
            onClick={() => openAsExamRoom(selectedPhysicalRoom)}
            className={primaryClass}
          >
            เปิดเป็นห้องสอบ
          </button>
        </div>
      ) : <>
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <div>
            <p className="text-xs font-semibold text-blue-700">ห้องที่เลือก</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedPhysicalRoom.roomCode}</h2>
            <p className="mt-1 text-xs text-slate-500">{floorText(selectedPhysicalRoom.floorId)} · {roomSeats(selectedRoom.id).length} ที่นั่ง · {roomComputers(selectedRoom.id).length} เครื่อง</p>
          </div>
          {!isEditingLayout && <button type="button" onClick={() => { setDimensions({ rows: selectedRoom.rows, columns: selectedRoom.columns }); setLayoutError(''); setIsEditingLayout(true); }} className={buttonClass}><Pencil className="h-4 w-4" />แก้ไขผัง</button>}
        </div>

        {isEditingLayout ? (
          <form onSubmit={submitLayout} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="จำนวนแถว"><input className={inputClass} type="number" min="0" max="100" required value={dimensions.rows} onChange={(event) => setDimensions({ ...dimensions, rows: Number(event.target.value) })} /></Field>
              <Field label="จำนวนคอลัมน์"><input className={inputClass} type="number" min="0" max="100" required value={dimensions.columns} onChange={(event) => setDimensions({ ...dimensions, columns: Number(event.target.value) })} /></Field>
              <div className="flex gap-2">
                <button type="button" onClick={cancelLayoutEdit} className={buttonClass}>ยกเลิก</button>
                <button type="submit" className={primaryClass}>บันทึกผัง</button>
              </div>
              <span className="py-2 text-xs text-slate-500">ผังใหม่ {dimensions.rows * dimensions.columns} ที่นั่ง · ปัจจุบัน {roomSeats(selectedRoom.id).length} ที่นั่ง</span>
            </div>
            <p className="text-xs text-slate-500">กำหนด 0 × 0 เพื่อล้างผังที่ไม่มีเครื่องหรือประวัติสอบอ้างอิง</p>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">จำนวนแถว</p><p className="mt-1 text-xl font-bold text-slate-900">{selectedRoom.rows}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">จำนวนคอลัมน์</p><p className="mt-1 text-xl font-bold text-slate-900">{selectedRoom.columns}</p></div>
          </div>
        )}

        {layoutError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{layoutError}</p>}
        <div className="rounded-xl bg-slate-100 p-3 text-center text-xs font-semibold text-slate-600">ด้านหน้าห้อง / กระดาน</div>
        {!roomSeats(selectedRoom.id).length ? (
          <p className="p-8 text-center text-sm text-slate-500">ยังไม่ได้กำหนดผังที่นั่ง</p>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${selectedRoom.columns}, minmax(100px, 1fr))` }}>
              {roomSeats(selectedRoom.id).sort((a, b) => a.row - b.row || a.column - b.column).map((seat) => {
                const device = state.computers.find((item) => item.seatId === seat.id);
                return <button key={seat.id} type="button" onClick={() => openEditor('computer', device?.id, seat.id)} className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs focus-visible:outline-2 focus-visible:outline-blue-600 ${device ? 'border-blue-200 bg-blue-50/50' : 'border-dashed border-slate-300'}`}><strong>{seat.seatCode}</strong><Monitor size={16} /><span>{device?.computerCode || 'ไม่มีเครื่อง'}</span>{device && <Status status={device.status} />}</button>;
              })}
            </div>
          </div>
        )}
      </>}
    </section>}

    {tab === 'computers' && <DataTable headings={['หมายเลขเครื่อง', 'ชั้น', 'ห้อง / ที่นั่ง', 'Serial Number', 'IP Address', 'MAC Address', 'สถานะ', 'การดำเนินการ']} emptyMessage={!filteredComputers.length ? state.computers.length ? 'ไม่พบข้อมูลที่ตรงกับตัวกรอง' : 'ยังไม่มีเครื่องคอมพิวเตอร์' : undefined}>{filteredComputers.map((device) => { const path = devicePath(device.seatId); return <tr key={device.id}><td className="font-semibold">{device.computerCode}</td><td>{floorText(path.floor?.id)}</td><td className="whitespace-nowrap">{path.room ? `${path.physicalRoom?.roomCode || 'ยังไม่ระบุ'} / ${path.seat?.seatCode}` : 'ยังไม่กำหนด'}</td><td>{device.serialNumber || <span className="text-amber-700">ยังไม่ระบุ</span>}</td><td className="font-mono">{device.ipAddress}</td><td className="whitespace-nowrap font-mono">{device.macAddress}</td><td><Status status={device.status} /></td><td>{computerActions(device.id)}</td></tr>; })}</DataTable>}

    <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={`${editor?.id ? 'แก้ไข' : 'เพิ่ม'}${editor?.kind === 'floor' ? 'ชั้น' : editor?.kind === 'physicalRoom' ? 'ห้องในชั้น' : editor?.kind === 'room' ? 'ห้องสอบ' : 'เครื่องคอมพิวเตอร์'}`} maxWidth="640"><form onSubmit={submit} className="space-y-4">
      {editor?.kind === 'floor' ? <Field label="หมายเลขชั้น"><input type="number" required min="0" max="200" value={form.floorNumber} onChange={(event) => setForm({ ...form, floorNumber: event.target.value })} className={inputClass} /></Field> : <>
        {editor?.kind === 'computer' && <div className="grid gap-3 sm:grid-cols-2">{(['computerCode', 'serialNumber', 'ipAddress', 'macAddress'] as const).map((key) => <Field key={key} label={({ computerCode: 'หมายเลขเครื่อง', serialNumber: 'Serial Number', ipAddress: 'IP Address', macAddress: 'MAC Address' })[key]}><input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={inputClass} /></Field>)}</div>}
        <Field label="ชั้น"><select disabled={roomRelationshipLocked || physicalFloorLocked} required={editor?.kind !== 'computer' || !editor?.id || Boolean(form.seatId)} value={form.floorId} onChange={(event) => setForm({ ...form, floorId: event.target.value, physicalRoomId: '', roomId: '', seatId: '' })} className={inputClass}><option value="">เลือกชั้น</option>{state.floors.filter((floor) => floor.status === 'active' || floor.id === form.floorId).map((floor) => <option key={floor.id} value={floor.id}>ชั้น {floor.floorNumber}{floor.status === 'inactive' ? ' (ปิดใช้งาน)' : ''}</option>)}</select></Field>
        {editor?.kind === 'physicalRoom' && <div className="grid gap-3 sm:grid-cols-2"><Field label="รหัสย่อย/เลขห้อง"><input required={!legacyPhysicalCode} maxLength={60} placeholder="เช่น 08 หรือ 01A" value={form.roomSuffix} onChange={(event) => setForm({ ...form, roomSuffix: event.target.value })} className={inputClass} /></Field><Field label="รหัสห้อง"><input readOnly value={roomCodePreview} placeholder="ระบบจะสร้างรหัสห้องอัตโนมัติ" className={`${inputClass} bg-slate-50 font-mono font-semibold text-blue-700`} /></Field></div>}
        {editor?.kind === 'physicalRoom' && legacyPhysicalCode && !form.roomSuffix && editingPhysicalRoom?.floorId === form.floorId && <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">รหัสเดิม “{form.roomCode}” จะถูกเก็บไว้ หากต้องการเปลี่ยนเป็นรูปแบบใหม่ ให้กรอกรหัสย่อย/เลขห้อง</p>}
        {physicalFloorLocked && <p className="text-xs text-slate-500">ไม่สามารถเปลี่ยนชั้นได้ เนื่องจากห้องนี้เปิดเป็นห้องสอบแล้ว แต่ยังแก้ไขรหัสและสถานะได้</p>}
        {editor?.kind === 'room' && <><Field label="ห้อง"><select disabled={!form.floorId || roomRelationshipLocked} required value={form.physicalRoomId} onChange={(event) => setForm({ ...form, physicalRoomId: event.target.value })} className={inputClass}><option value="">เลือกห้อง</option>{availablePhysicalRooms.map((physical) => { const opened = state.rooms.some((room) => room.id !== editor.id && room.physicalRoomId === physical.id); const selectable = physical.status === 'active' && !opened; return <option key={physical.id} value={physical.id} disabled={!selectable && physical.id !== currentExamRoom?.physicalRoomId}>{physical.roomCode}{opened ? ' — เปิดเป็นห้องสอบแล้ว' : physical.status === 'inactive' ? ' — ปิดใช้งาน' : ''}</option>; })}</select></Field>{form.floorId && !availablePhysicalRooms.length && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">ยังไม่มีห้องในชั้นนี้ กรุณาเพิ่มห้องในชั้นก่อน</p>}{form.floorId && availablePhysicalRooms.length > 0 && availablePhysicalRooms.every((physical) => physical.status === 'inactive' || state.rooms.some((room) => room.id !== editor.id && room.physicalRoomId === physical.id)) && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">ห้องทั้งหมดในชั้นนี้ถูกเปิดเป็นห้องสอบแล้วหรือปิดใช้งาน</p>}{roomRelationshipLocked && <p className="text-xs text-slate-500">ห้องจริงถูกล็อกเพราะมีผังหรือประวัติการสอบอ้างอิง ยังเปลี่ยนสถานะห้องสอบได้</p>}</>}
        {editor?.kind === 'computer' && <><Field label="ห้องสอบ"><select disabled={!form.floorId} required={Boolean(form.floorId)} value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value, seatId: '' })} className={inputClass}><option value="">เลือกห้องสอบ</option>{formRooms.map((room) => <option key={room.id} value={room.id}>{resolveExamRoom(state, room).physicalRoom?.roomCode || 'ยังไม่ระบุ'}</option>)}</select></Field><Field label="ที่นั่ง"><select disabled={!form.roomId} required={Boolean(form.roomId)} value={form.seatId} onChange={(event) => setForm({ ...form, seatId: event.target.value })} className={inputClass}><option value="">เลือกที่นั่งว่าง</option>{formSeats.map((seat) => <option key={seat.id} value={seat.id}>{seat.seatCode}</option>)}</select></Field>{editor.id && <button type="button" className={buttonClass} onClick={() => setForm({ ...form, floorId: '', roomId: '', seatId: '' })}>นำเครื่องออกจากที่นั่ง</button>}</>}
      </>}
      <Field label="สถานะ"><select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{Object.entries(editor?.kind === 'floor' || editor?.kind === 'physicalRoom' ? physicalRoomStatusLabels : readinessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setEditor(null)} className={buttonClass}>ยกเลิก</button><button type="submit" className={primaryClass}>บันทึก</button></div>
    </form></Modal>

    <Modal isOpen={Boolean(confirm)} onClose={() => setConfirm(null)} title="ยืนยันการลบ"><p className="text-sm">ยืนยันลบข้อมูลนี้หรือไม่? ระบบจะตรวจสอบการอ้างอิงก่อนลบ</p>{error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button onClick={() => setConfirm(null)} className={buttonClass}>ยกเลิก</button><button className={primaryClass} onClick={() => { if (confirm) { const result = manageRooms(confirm); if (result.success) setConfirm(null); else setError(result.error || 'ลบไม่สำเร็จ'); } }}>ยืนยันลบ</button></div></Modal>

    <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title="รายละเอียด">{detail && (() => {
      const physicalRoom = detail.kind === 'physicalRoom' ? state.physicalRooms.find((item) => item.id === detail.id) : undefined;
      const examRoom = physicalRoom ? state.rooms.find((room) => room.physicalRoomId === physicalRoom.id) : undefined;
      const floor = state.floors.find((item) => item.id === physicalRoom?.floorId);
      const device = detail.kind === 'computer' ? state.computers.find((item) => item.id === detail.id) : undefined;
      const path = devicePath(device?.seatId || null);
      const entries = physicalRoom ? [['ชั้น', floorText(floor?.id)], ['รหัสห้อง', physicalRoom.roomCode], ['สถานะห้อง', physicalRoomStatusLabels[physicalRoom.status]], ['สถานะการเปิดเป็นห้องสอบ', examRoom ? 'เปิดเป็นห้องสอบแล้ว' : 'ยังไม่ได้เปิดเป็นห้องสอบ'], ['สถานะห้องสอบ', examRoom ? readinessLabels[examRoom.status] : '—'], ['ผังห้อง', examRoom ? examRoom.rows && examRoom.columns ? `${examRoom.rows} × ${examRoom.columns}` : 'ยังไม่มีผัง' : '—'], ['จำนวนที่นั่ง', examRoom ? roomSeats(examRoom.id).length : '—'], ['จำนวนเครื่องคอมพิวเตอร์', examRoom ? roomComputers(examRoom.id).length : '—']] : device ? [['หมายเลขเครื่อง', device.computerCode], ['Serial Number', device.serialNumber || 'ยังไม่ระบุ'], ['IP Address', device.ipAddress], ['MAC Address', device.macAddress], ['ชั้น', floorText(path.floor?.id)], ['ห้อง', path.physicalRoom?.roomCode || 'ยังไม่กำหนด'], ['ที่นั่ง', path.seat?.seatCode || 'ยังไม่กำหนด'], ['สถานะ', readinessLabels[device.status]]] : [];
      return <dl className="space-y-3 text-sm">{entries.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b pb-2"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right font-semibold">{value}</dd></div>)}</dl>;
    })()}</Modal>
  </div>;
};
