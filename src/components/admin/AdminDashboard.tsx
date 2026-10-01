import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldAlert,
  Server,
  Users,
  Monitor,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HardDrive,
  FileText,
  Clock,
  Cpu
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { countEffectiveExamStatuses } from '../../services/examStatus';
import { useExamClock } from '../../utils/useExamClock';

export const AdminDashboard: React.FC = () => {
  const now = useExamClock();
  const {
    examSessions,
    rooms,
    students,
    teachers,
    violations,
    auditLogs,
    setActiveAdminRoute,
    acknowledgeViolation,
    language,
  } = useApp();
  const isThai = language === 'th';

  const activeExamCount = countEffectiveExamStatuses(examSessions, now).in_progress;
  const totalStations = rooms.reduce((acc, r) => acc + r.seats.length, 0);
  const damagedTotal = rooms.reduce(
    (acc, r) => acc + r.seats.filter((s) => s.status === 'damaged').length,
    0
  );

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'การจัดการระบบส่วนกลาง (A1)' : 'System Administration (A1)'}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {isThai ? 'ความปลอดภัย & โครงสร้างพื้นฐานระบบ' : 'Admin Security & Infrastructure'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isThai
              ? 'ภาพรวมสถานะการทำงานของคอมพิวเตอร์ในห้องปฏิบัติการ ระบบตรวจพิสูจน์อัตลักษณ์ชีวมิติ และความสมบูรณ์ของบันทึกระบบ'
              : 'Global operational overview of laboratory hardware nodes, biometric verification pipelines, and audit integrity.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{isThai ? 'สถานะโครงสร้างพื้นฐาน: พร้อมสมบูรณ์ (99.98%)' : 'Infrastructure Health: Optimal (99.98%)'}</span>
          </div>
        </div>
      </div>

      {/* 4 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveAdminRoute('A4')}
          className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">
              {isThai ? 'การสอบที่ดำเนินการอยู่' : 'Live Exam Sessions'}
            </span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900 font-mono">{activeExamCount}</div>
          <div className="text-xs text-blue-600 mt-1 font-medium">
            {activeExamCount ? `มี ${activeExamCount} การสอบที่กำลังดำเนินการ` : 'ไม่มีการสอบที่กำลังดำเนินการ'}
          </div>
        </div>

        <div
          onClick={() => setActiveAdminRoute('A2')}
          className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">
              {isThai ? 'นักศึกษาที่ลงทะเบียน' : 'Registered Students'}
            </span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900 font-mono">{students.length}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">
            {isThai ? 'เชื่อมโยง ICIT ครบ 100%' : '100% ICIT Bound'}
          </div>
        </div>

        <div
          onClick={() => setActiveAdminRoute('A4')}
          className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">
              {isThai ? 'เครื่องคอมพิวเตอร์ทั้งหมด' : 'Total Workstations'}
            </span>
            <Monitor className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900 font-mono">{totalStations}</div>
          <div className="text-xs text-purple-600 mt-1 font-medium">
            {isThai ? '2 ห้องปฏิบัติการคอมพิวเตอร์' : '2 Computer Labs'}
          </div>
        </div>

        <div
          onClick={() => setActiveAdminRoute('A8')}
          className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">
              {isThai ? 'การแจ้งเตือนการทุจริต' : 'Active Violations'}
            </span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600 font-mono">{violations.length}</div>
          <div className="text-xs text-red-600 mt-1 font-medium">
            {isThai ? 'ต้องให้ผู้คุมสอบตรวจสอบ' : 'Requires Proctor Review'}
          </div>
        </div>
      </div>

      {/* Lab Workstation Status Summary by Room */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gray-700" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isThai ? 'ความพร้อมของห้องแล็บ & สถานะฮาร์ดแวร์' : 'Laboratory Readiness & Hardware Status'}
              </h2>
              <p className="text-xs text-gray-500">
                {isThai
                  ? 'ข้อมูลมาตรวัดรวบรวมจากทุกเครื่องในห้องปฏิบัติการคอมพิวเตอร์ของการสอบ'
                  : 'Telemetry aggregated across all university computer examination rooms'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveAdminRoute('A4')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <span>{isThai ? 'จัดการฮาร์ดแวร์' : 'Manage Hardware'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => {
            const online = room.seats.filter((s) => s.status === 'online').length;
            const offline = room.seats.filter((s) => s.status === 'offline').length;
            const damaged = room.seats.filter((s) => s.status === 'damaged').length;
            const unavailable = room.seats.filter((s) => s.status === 'unavailable').length;

            return (
              <div key={room.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <div className="flex items-center justify-between font-bold text-sm text-gray-900 mb-2">
                  <span>{room.labName}</span>
                  <span className="text-xs font-mono font-normal text-gray-500">
                    {isThai ? 'ชั้น ' : 'Floor '}
                    {room.floor}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-lg font-bold text-emerald-800 font-mono block">{online}</span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      {isThai ? 'ออนไลน์' : 'Online'}
                    </span>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg border border-gray-200">
                    <span className="text-lg font-bold text-gray-700 font-mono block">{offline}</span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {isThai ? 'ออฟไลน์' : 'Offline'}
                    </span>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-lg font-bold text-red-700 font-mono block">{damaged}</span>
                    <span className="text-[10px] text-red-500 font-medium">
                      {isThai ? 'ชำรุด' : 'Damaged'}
                    </span>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-lg font-bold text-amber-700 font-mono block">{unavailable}</span>
                    <span className="text-[10px] text-amber-500 font-medium">
                      {isThai ? 'ไม่พร้อมใช้' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Recent Violations & Audit Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Violations */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>{isThai ? 'การละเมิดกฎการสอบล่าสุด' : 'Recent Cheating Breaches'}</span>
            </h3>
            <button
              onClick={() => setActiveAdminRoute('A8')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              {isThai ? 'ดูทั้งหมด' : 'View All'} &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {violations.slice(0, 3).map((vio) => {
              const std = students.find((s) => s.id === vio.studentId);
              return (
                <div
                  key={vio.id}
                  className="p-3 rounded-xl bg-red-50/70 border border-red-200 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-red-900 flex items-center gap-1.5">
                      <span>
                        {isThai ? 'ที่นั่ง ' : 'Seat '}
                        {vio.seatNo}:
                      </span>
                      <span className="text-gray-900">{std?.fullName}</span>
                    </div>
                    <div className="text-red-700 text-[11px] mt-0.5">{vio.detail}</div>
                    <div className="text-gray-400 text-[10px] font-mono mt-1">
                      {isThai ? 'ตรวจพบ: ' : 'Detected: '}
                      {vio.detectedAt}
                    </div>
                  </div>

                  {!vio.acknowledged && (
                    <button
                      onClick={() => acknowledgeViolation(vio.id)}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-[10px] shrink-0 cursor-pointer"
                    >
                      {isThai ? 'รับทราบ' : 'Acknowledge'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Audit Log Activity Stream */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-700" />
              <span>{isThai ? 'ประวัติกิจกรรมในระบบ (Audit Stream)' : 'Audit Activity Stream'}</span>
            </h3>
            <button
              onClick={() => setActiveAdminRoute('A10')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              {isThai ? 'ดูประวัติทั้งหมด' : 'Full Log'} &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {auditLogs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-gray-800">{log.action}</div>
                  <div className="text-gray-400 text-[10px] font-mono">
                    {isThai ? 'โดย: ' : 'By: '}
                    {log.performedBy} ({log.role}) • {log.timestamp}
                  </div>
                </div>
                <Badge variant={log.status === 'success' ? 'success' : 'danger'} size="sm">
                  {log.status === 'success' ? (isThai ? 'สำเร็จ' : 'success') : isThai ? 'ข้อผิดพลาด' : 'error'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
