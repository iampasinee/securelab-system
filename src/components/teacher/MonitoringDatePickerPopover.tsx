import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatMonitoringExamCount,
  getLocalDateInputValue,
  getMonitoringCalendarDateCells,
  getMonitoringDateSummaries,
  getMonitoringMonthSummary,
  selectMonitoringCalendarDate,
  TeacherMonitoringExam,
} from '../../services/teacherMonitoring';

interface MonitoringDatePickerPopoverProps {
  exams: TeacherMonitoringExam[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onShowDaily: () => void;
}

const parseDate = (date: string) => new Date(`${date}T12:00:00`);

const formatThaiDate = (date: string, month: 'short' | 'long' = 'long') => parseDate(date)
  .toLocaleDateString('th-TH', { day: 'numeric', month, year: 'numeric' });

export const MonitoringDatePickerPopover: React.FC<MonitoringDatePickerPopoverProps> = ({
  exams,
  selectedDate,
  onSelectDate,
  onShowDaily,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const selected = parseDate(selectedDate || getLocalDateInputValue());
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const today = getLocalDateInputValue();

  useEffect(() => {
    const selected = parseDate(selectedDate || today);
    setMonthCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selectedDate, today]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const summaries = useMemo(() => getMonitoringDateSummaries(exams), [exams]);
  const summaryByDate = useMemo(
    () => new Map(summaries.map((summary) => [summary.date, summary])),
    [summaries],
  );
  const selectedCount = summaryByDate.get(selectedDate)?.examCount || 0;
  const monthSummary = useMemo(
    () => getMonitoringMonthSummary(exams, monthCursor.getFullYear(), monthCursor.getMonth()),
    [exams, monthCursor],
  );
  const cells = useMemo(
    () => getMonitoringCalendarDateCells(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor],
  );
  const monthLabel = monthCursor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  const chooseDate = (date: string) => {
    const next = selectMonitoringCalendarDate(date);
    onSelectDate(next.selectedDate);
    onShowDaily();
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <div className="flex min-h-11 w-full items-center rounded-xl border border-gray-200 bg-white p-1 shadow-xs sm:w-auto">
        <span className="hidden whitespace-nowrap px-2 text-[11px] font-semibold text-gray-500 lg:inline">ปฏิทินวันที่:</span>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls={popoverId}
          aria-haspopup="dialog"
          onClick={() => setIsOpen((current) => !current)}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:flex-none"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="min-w-0 truncate whitespace-nowrap">{formatThaiDate(selectedDate)}</span>
          <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{formatMonitoringExamCount(selectedCount)}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => chooseDate(today)}
          className="min-h-8 shrink-0 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          วันนี้
        </button>
      </div>

      {isOpen && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="เลือกวันที่ติดตามการสอบ"
          className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-[390px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-3 py-3">
            <button
              type="button"
              onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              aria-label="เดือนก่อนหน้า"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <h2 className="text-sm font-bold text-gray-900">{monthLabel}</h2>
              <p className="mt-0.5 text-[10px] font-medium text-blue-600">เดือนนี้มีการสอบ {monthSummary.totalExams} รายการ</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => chooseDate(today)}
                className="min-h-8 rounded-lg bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                aria-label="เดือนถัดไป"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400">
              {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((day, index) => (
                <div key={day} className={`py-1.5 ${index === 0 || index === 6 ? 'text-orange-500' : ''}`}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map(({ date, isCurrentMonth }) => {
                const summary = summaryByDate.get(date);
                const isSelected = date === selectedDate;
                const isToday = date === today;
                const accessibleLabel = summary
                  ? `${formatThaiDate(date)} มีการสอบ ${formatMonitoringExamCount(summary.examCount)}`
                  : `${formatThaiDate(date)} ไม่มีการสอบ`;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => chooseDate(date)}
                    aria-label={accessibleLabel}
                    title={accessibleLabel}
                    className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : isToday ? 'border-blue-300 bg-blue-50 text-blue-700' : summary ? 'border-blue-100 bg-blue-50/50 text-gray-700 hover:border-blue-300' : 'border-transparent text-gray-600 hover:bg-gray-50'} ${isCurrentMonth ? '' : 'opacity-40'}`}
                  >
                    <span className="text-[11px] font-semibold">{Number(date.slice(-2))}</span>
                    {summary && <span className={`mt-0.5 whitespace-nowrap rounded-full px-1 py-px text-[8px] font-bold leading-tight ${isSelected ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'}`}>{formatMonitoringExamCount(summary.examCount)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-gray-600">วันที่มีการสอบในระบบ:</p>
              <span className="text-[10px] font-bold text-blue-600">{summaries.length} วัน</span>
            </div>
            <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {summaries.length > 0 ? summaries.map((summary) => (
                <button
                  key={summary.date}
                  type="button"
                  onClick={() => chooseDate(summary.date)}
                  className={`rounded-lg px-2 py-1 text-[9px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${summary.date === selectedDate ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-blue-700'}`}
                >
                  {formatThaiDate(summary.date, 'short')} <span className={summary.date === selectedDate ? 'text-blue-100' : 'text-blue-600'}>{formatMonitoringExamCount(summary.examCount)}</span>
                </button>
              )) : <span className="py-1 text-[10px] text-gray-400">ยังไม่มีตารางสอบ</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
