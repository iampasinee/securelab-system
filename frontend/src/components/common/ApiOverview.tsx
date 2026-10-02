import React from 'react';
import { useApp } from '../../context/AppContext';

export const ApiOverview: React.FC = () => {
  const { role, apiOverview, courses, apiLoading } = useApp();
  const overview = apiOverview || {};
  const exams = (overview.exams || {}) as Record<string, number>;
  const users = (overview.users || {}) as Record<string, number>;
  const rooms = (overview.rooms || {}) as Record<string, number>;
  const cards: Array<[string, unknown]> = [
    ['การสอบทั้งหมด', exams.total], ['กำลังสอบ', exams.in_progress], ['กำลังจะเริ่ม', exams.upcoming], ['เสร็จสิ้น', exams.completed],
    ['งาน FINAL ที่รับแล้ว', overview.submittedCount], ['เหตุที่รอตรวจ', overview.pendingReviewCount], ['ผู้มีสิทธิ์สอบรวม', overview.participantCount],
    ...(role === 'admin' ? [['นักศึกษา', users.student], ['อาจารย์', users.teacher], ['ผู้ดูแลระบบ', users.admin], ['ห้องสอบ', rooms.examRooms], ['ห้องสอบพร้อมใช้', rooms.ready]] as Array<[string, unknown]> : [['รายวิชาที่ได้รับมอบหมาย', courses.length]] as Array<[string, unknown]>),
  ];
  return <div className="space-y-5"><header className="border-b pb-4"><h1 className="text-2xl font-bold">{role === 'admin' ? 'ภาพรวมระบบ SecureLab' : 'ภาพรวมการสอบที่รับผิดชอบ'}</h1><p className="mt-2 text-sm text-gray-500">ข้อมูลจาก server ปรับปรุงทุก 5 วินาที</p></header><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{cards.map(([label, count]) => <article key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">{label}</p><p className="mt-3 text-3xl font-bold">{typeof count === 'number' ? count : apiLoading ? '…' : '—'}</p></article>)}</div><p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-600">ยังไม่มีผลตรวจใบหน้า สถานะเครื่องจาก heartbeat หรือการบังคับนโยบาย Agent และเครือข่ายจริง</p></div>;
};
