import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatMonitoringExamCount,
  getCalendarMonthCells,
  getLocalDateInputValue,
  getMonitoringDateSummaries,
  selectMonitoringCalendarDate,
  TeacherMonitoringExam,
} from '../../services/teacherMonitoring';

interface MonitoringCalendarProps {
  exams: TeacherMonitoringExam[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onShowDaily: () => void;
}

const formatThaiDate = (date: string, month: 'short' | 'long' = 'long') => new Date(`${date}T12:00:00`)
  .toLocaleDateString('th-TH', { day: 'numeric', month, year: 'numeric' });

export const MonitoringCalendar: React.FC<MonitoringCalendarProps> = ({
  exams,
  selectedDate,
  onSelectDate,
  onShowDaily,
}) => {
  const [monthCursor, setMonthCursor] = useState(() => {
    const initial = new Date(`${selectedDate || getLocalDateInputValue()}T12:00:00`);
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const today = getLocalDateInputValue();

  useEffect(() => {
    const date = new Date(`${selectedDate || getLocalDateInputValue()}T12:00:00`);
    setMonthCursor(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [selectedDate]);

  const summaries = useMemo(() => getMonitoringDateSummaries(exams), [exams]);
  const summaryByDate = useMemo(() => new Map(summaries.map((summary) => [summary.date, summary])), [summaries]);
  const cells = getCalendarMonthCells(monthCursor.getFullYear(), monthCursor.getMonth());
  const monthLabel = monthCursor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  const selectDate = (date: string) => {
    const next = selectMonitoringCalendarDate(date);
    onSelectDate(next.selectedDate);
    onShowDaily();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs" aria-label="ปฏิทินการสอบ">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarDays className="h-5 w-5" /></span><div><h2 className="text-base font-bold text-gray-900">{monthLabel}</h2><p className="text-[11px] text-gray-500">เลือกวันที่เพื่อเปิดรายการสอบประจำวัน</p></div></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="เดือนก่อนหน้า" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => selectDate(today)} className="min-h-9 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100">วันนี้</button>
          <button type="button" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="เดือนถัดไป" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="p-2 sm:p-4">
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 sm:text-xs">
          {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((day) => <div key={day} className="py-2">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} aria-hidden="true" className="min-h-16 rounded-xl bg-gray-50/40 sm:min-h-24" />;
            const summary = summaryByDate.get(date);
            const day = Number(date.slice(-2));
            const isSelected = date === selectedDate;
            const isToday = date === today;
            const accessibleLabel = summary
              ? `${formatThaiDate(date)} มีการสอบ ${formatMonitoringExamCount(summary.examCount)}`
              : `${formatThaiDate(date)} ไม่มีการสอบ`;
            return (
              <button
                key={date}
                type="button"
                onClick={() => selectDate(date)}
                aria-label={accessibleLabel}
                title={accessibleLabel}
                className={`min-h-16 min-w-0 rounded-xl border p-1.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-h-24 sm:p-2.5 ${isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : isToday ? 'border-blue-300 bg-blue-50 text-blue-700' : summary ? 'border-blue-100 bg-blue-50/50 text-gray-700 hover:border-blue-300 hover:shadow-sm' : 'border-gray-100 bg-gray-50/40 text-gray-700 hover:bg-gray-50'}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isSelected ? 'text-white' : isToday ? 'border border-blue-400 text-blue-700' : 'text-gray-700'}`}>{day}</span>
                {summary && <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:text-[11px] ${isSelected ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'}`}>{formatMonitoringExamCount(summary.examCount)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50/60 p-4">
        <p className="text-[11px] font-semibold text-gray-600">วันที่มีการสอบในระบบ</p>
        <div className="mt-2 flex flex-wrap gap-2">{summaries.length ? summaries.map((summary) => <button key={summary.date} type="button" onClick={() => selectDate(summary.date)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${summary.date === selectedDate ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700'}`}>{formatThaiDate(summary.date, 'short')} <span className={summary.date === selectedDate ? 'ml-1 text-blue-100' : 'ml-1 text-blue-600'}>{formatMonitoringExamCount(summary.examCount)}</span></button>) : <span className="text-xs text-gray-400">ยังไม่มีตารางสอบ</span>}</div>
      </div>
    </section>
  );
};
