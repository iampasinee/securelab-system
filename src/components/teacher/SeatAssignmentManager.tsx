import { calculateYearLevelFromAdmissionYear } from '../../utils/academicYear';
import { studentMatchesExamSection } from '../../services/courseState';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Grid3X3,
  Sparkles,
  Users,
  Monitor,
  AlertTriangle,
  CheckCircle2,
  Shuffle,
  RefreshCw,
  Move,
  ArrowRight,
  Info
} from 'lucide-react';
import { Badge, MachineStatusBadge } from '../common/Badge';
import { canEditExamSeats } from '../../services/examStatus';

export const SeatAssignmentManager: React.FC = () => {
  const {
    examSessions,
    courses,
    rooms,
    students,
    seatAssignments,
    assignSeat,
    unassignSeat,
    autoAssignSeats,
    setActiveTeacherRoute,
    showToast,
    language,
  } = useApp();
  const isThai = language === 'th';

  const activeExam = examSessions[0];
  const canEditSeats = Boolean(activeExam && canEditExamSeats(activeExam, new Date()));
  const room = rooms.find((r) => r.id === activeExam?.roomId) || rooms[0];
  const activeSection = courses.find((course) => course.id === activeExam?.courseId)?.sections
    .find((section) => section.sectionNo === activeExam?.sectionNo);
  const eligibleStudents = students.filter((student) => activeExam && studentMatchesExamSection(student, activeExam, activeSection));

  const [selectedSeatNo, setSelectedSeatNo] = useState<string | null>(null);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);

  // Get student assigned to seat
  const getStudentAtSeat = (seatNo: string) => {
    const assignment = seatAssignments.find(
      (sa) => sa.examId === activeExam?.id && sa.seatNo === seatNo
    );
    if (!assignment) return null;
    return eligibleStudents.find((s) => s.id === assignment.studentId);
  };

  // Get list of unassigned students
  const assignedStudentIds = new Set(
    seatAssignments.filter((sa) => sa.examId === activeExam?.id).map((sa) => sa.studentId)
  );
  const unassignedStudents = eligibleStudents.filter(
    (s) => s.accountStatus === 'active' && !assignedStudentIds.has(s.id)
  );

  const handleSeatClick = (seatNo: string) => {
    if (!canEditSeats) return;
    const station = room?.seats?.find((s) => s.seatNo === seatNo);
    if (station?.status === 'damaged' || station?.status === 'unavailable') {
      const statusText = station?.status?.toUpperCase() || 'UNAVAILABLE';
      showToast(
        isThai ? 'เครื่องนี้ไม่สามารถใช้งานได้' : 'Station Unavailable',
        isThai
          ? `ที่นั่ง ${seatNo} ถูกระบุสถานะเป็น ${statusText} จึงไม่สามารถจัดที่นั่งได้`
          : `Seat ${seatNo} is marked ${statusText} and cannot be assigned.`,
        'warning'
      );
      return;
    }

    if (selectedSeatNo === seatNo) {
      setSelectedSeatNo(null);
    } else {
      setSelectedSeatNo(seatNo);
    }
  };

  const handleAssignToSelected = (studentId: string) => {
    if (!selectedSeatNo || !canEditSeats) return;
    assignSeat(activeExam.id, selectedSeatNo, studentId);
    showToast(
      isThai ? 'จัดที่นั่งสำเร็จ' : 'Seat Assigned',
      isThai ? `จัดนักศึกษาลงที่นั่ง ${selectedSeatNo} เรียบร้อยแล้ว` : `Student assigned to Seat ${selectedSeatNo}.`,
      'success'
    );
    setSelectedSeatNo(null);
  };

  const handleUnassignCurrentSeat = () => {
    if (!selectedSeatNo || !canEditSeats) return;
    unassignSeat(activeExam.id, selectedSeatNo);
    showToast(
      isThai ? 'ยกเลิกการจัดที่นั่งแล้ว' : 'Seat Cleared',
      isThai ? `เครื่องคอมพิวเตอร์ที่นั่ง ${selectedSeatNo} ว่างแล้ว` : `Workstation ${selectedSeatNo} is now open.`,
      'info'
    );
    setSelectedSeatNo(null);
  };

  const rows = [...new Set(room.seats.map((seat) => seat.seatNo.replace(/\d+$/, '')))];
  const columns = Array.from({ length: room.columns || 8 }, (_, i) => i + 1);

  return (
    <div className="space-y-6 text-left">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'ผังที่นั่งสอบเครื่องคอมพิวเตอร์ (T4)' : 'Workstation Mapping (T4)'}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {isThai ? 'การจัดผังที่นั่งสอบในห้องปฏิบัติการ' : 'Laboratory Seat Assignment'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isThai
              ? `จัดสรรผู้เข้าสอบประจำเครื่องคอมพิวเตอร์ในห้อง ${room.labName} (ชั้น ${room.floor}) โดยระบบจะคัดแยกเครื่องชำรุดและปิดใช้งานออกอัตโนมัติ`
              : `Allocate examinees to computer workstations in ${room.labName} (Floor ${room.floor}). Damaged and unavailable stations are automatically excluded.`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => autoAssignSeats(activeExam.id, room.id)}
            disabled={!canEditSeats}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            <span>{isThai ? 'จัดที่นั่งอัตโนมัติ' : 'Auto-Assign Active Examinees'}</span>
          </button>

          {!canEditSeats && <span className="text-xs text-amber-700">การสอบสิ้นสุดแล้ว ไม่สามารถเปลี่ยนผังที่นั่งย้อนหลัง</span>}

          <button
            onClick={() => setActiveTeacherRoute('T5')}
            className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>{isThai ? 'ไปยังระบบคุมสอบสด (T5)' : 'Proceed to Live Monitor'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Seating Map Legends */}
      <div className="flex flex-wrap items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-400" />
            <span>{isThai ? 'มีผู้เข้าสอบประจำที่' : 'Assigned Examinee'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-white border border-gray-300" />
            <span>{isThai ? 'เครื่องว่าง / ใช้งานได้' : 'Empty / Available PC'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300 opacity-60" />
            <span>{isThai ? 'เครื่องออฟไลน์' : 'Offline PC'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-400 text-red-700 text-[10px] font-bold flex items-center justify-center">
              ✕
            </div>
            <span>{isThai ? 'เครื่องชำรุด (D4)' : 'Damaged PC (D4)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-amber-100 border border-amber-400" />
            <span>{isThai ? 'ปิดการใช้งาน (E8)' : 'Unavailable (E8)'}</span>
          </div>
        </div>

        <div className="text-xs font-medium text-gray-700">
          {isThai ? 'ความจุ: ' : 'Capacity: '}
          <strong>{seatAssignments.filter((sa) => sa.examId === activeExam.id).length}</strong> / {room.seats.length}{' '}
          {isThai ? 'ที่นั่งที่จัดแล้ว' : 'Stations Seated'}
        </div>
      </div>

      {/* Main Grid & Unassigned Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Visual Seating Grid (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
          {/* Front of Room / Whiteboard */}
          <div className="mb-6 p-2 rounded-xl bg-slate-100 border border-slate-200 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
            {isThai
              ? '— ด้านหน้าห้องปฏิบัติการ / โต๊ะผู้คุมสอบ & โปรเจกเตอร์ —'
              : '— FRONT OF LABORATORY / INSTRUCTOR PROCTOR PODIUM & PROJECTOR —'}
          </div>

          <div className="space-y-4">
            {rows.map((rowLetter) => (
              <div key={rowLetter} className="flex items-center gap-2">
                <span className="w-6 font-bold text-gray-500 text-sm font-mono text-center">
                  {rowLetter}
                </span>

                <div className="grid gap-2.5 flex-1 min-w-0" style={{ gridTemplateColumns: `repeat(${room.columns || 1}, minmax(0, 1fr))` }}>
                  {columns.map((colNum) => {
                    const seatNo = `${rowLetter}${colNum}`;
                    const station = room?.seats?.find((s) => s.seatNo === seatNo);
                    const student = getStudentAtSeat(seatNo);
                    const isSelected = selectedSeatNo === seatNo;

                    const isDamaged = station?.status === 'damaged';
                    const isUnavailable = station?.status === 'unavailable' || station?.disabled;
                    const isOffline = station?.status === 'offline';

                    let seatBg = 'bg-white hover:border-blue-400 border-gray-200';
                    if (isDamaged) seatBg = 'bg-red-50 border-red-300 opacity-70 cursor-not-allowed';
                    else if (isUnavailable) seatBg = 'bg-amber-50 border-amber-300 opacity-60 cursor-not-allowed';
                    else if (isOffline) seatBg = 'bg-gray-100 border-gray-300';
                    else if (student) seatBg = 'bg-emerald-50/80 border-emerald-300';

                    if (isSelected) seatBg += ' ring-2 ring-blue-500 border-blue-500 shadow-md';

                    return (
                      <div
                        key={seatNo}
                        onClick={() => handleSeatClick(seatNo)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer text-center relative flex flex-col justify-between min-h-[82px] ${seatBg}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-gray-900">{seatNo}</span>
                          {isDamaged ? (
                            <span className="text-[10px] text-red-600 font-bold">DMG</span>
                          ) : isOffline ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                        </div>

                        {student ? (
                          <div className="mt-1">
                            <div className="text-[11px] font-bold text-emerald-950 truncate">
                              {student.fullName.split(' ')[0]}
                            </div>
                            <div className="text-[9px] font-mono text-emerald-700 truncate">
                              {student.studentCode.slice(-4)}
                            </div>
                          </div>
                        ) : isDamaged ? (
                          <span className="text-[10px] text-red-600 mt-1">
                            {isThai ? 'ชำรุด' : 'Faulty'}
                          </span>
                        ) : isUnavailable ? (
                          <span className="text-[10px] text-amber-700 mt-1">
                            {isThai ? 'งดใช้' : 'Blocked'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 mt-1">
                            {isThai ? 'ว่าง' : 'Empty'}
                          </span>
                        )}

                        <span className="text-[9px] font-mono text-gray-400 block mt-0.5">
                          {station?.machineNo.replace('PC-301-', '#') || ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Selected Seat Controls */}
          {selectedSeatNo && canEditSeats && (
            <div className="mt-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <strong className="text-blue-900 block font-semibold">
                  {isThai ? 'ที่นั่งที่เลือก: หมายเลข ' : 'Station Selected: Seat '}
                  {selectedSeatNo}
                </strong>
                <span className="text-blue-700">
                  {getStudentAtSeat(selectedSeatNo)
                    ? isThai
                      ? `ผู้เข้าสอบประจำที่: ${getStudentAtSeat(selectedSeatNo)?.fullName} (${getStudentAtSeat(selectedSeatNo)?.studentCode})`
                      : `Occupied by: ${getStudentAtSeat(selectedSeatNo)?.fullName} (${getStudentAtSeat(selectedSeatNo)?.studentCode})`
                    : isThai
                    ? 'ที่นั่งนี้ว่างอยู่ เลือกนักศึกษาที่ยังไม่มีที่นั่งจากแถบด้านขวาเพื่อกำหนดลงที่นั่งนี้'
                    : 'Station is open. Select an unassigned student from the list on the right to place here.'}
                </span>
              </div>

              {getStudentAtSeat(selectedSeatNo) && (
                <button
                  type="button"
                  onClick={handleUnassignCurrentSeat}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  {isThai ? 'ยกเลิกที่นั่งนี้' : 'Unassign Seat'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Unassigned Students Pool (1 Col) */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{isThai ? 'ผู้เข้าสอบที่ยังไม่มีที่นั่ง' : 'Unassigned Examinees'}</span>
            </h3>
            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {unassignedStudents.length}
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[500px] flex-1 pr-1">
            {unassignedStudents.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                {isThai
                  ? 'ผู้เข้าสอบทุกคนได้รับการจัดที่นั่งคอมพิวเตอร์ครบถ้วนแล้ว'
                  : 'All examinees currently have assigned workstations.'}
              </div>
            ) : (
              unassignedStudents.map((std) => (
                <div
                  key={std.id}
                  className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-300 transition-all text-xs"
                >
                  <div className="font-semibold text-gray-900">{std.fullName}</div>
                  <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                    {std.studentCode} • {isThai ? 'ชั้นปี ' : 'Year '}
                    {std.admissionYear ? calculateYearLevelFromAdmissionYear(std.admissionYear).yearLevel || '—' : '—'}
                  </div>

                  {selectedSeatNo && canEditSeats ? (
                    <button
                      onClick={() => handleAssignToSelected(std.id)}
                      className="mt-2 w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      {isThai ? `จัดลงที่นั่ง ${selectedSeatNo}` : `Assign to Seat ${selectedSeatNo}`}
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {isThai ? 'คลิกเลือกที่นั่งในผังก่อนเพื่อจัดลง' : 'Click a seat first to assign'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
