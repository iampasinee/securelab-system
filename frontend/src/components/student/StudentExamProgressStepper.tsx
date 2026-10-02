import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type StudentExamProgressStep = 1 | 2 | 3 | 4;
type StepStatus = 'completed' | 'current' | 'upcoming' | 'error';

interface StudentExamProgressStepperProps {
  currentStep: StudentExamProgressStep;
  allCompleted?: boolean;
  errorStep?: 4;
  statusMessage?: string;
}

export const StudentExamProgressStepper: React.FC<StudentExamProgressStepperProps> = ({
  currentStep,
  allCompleted = false,
  errorStep,
  statusMessage,
}) => {
  const { language } = useApp();
  const isThai = language === 'th';
  const steps = [
    { number: 1 as const, th: 'ยืนยันตัวตน', en: 'Identity Verification' },
    { number: 2 as const, th: 'ตรวจสอบข้อมูลและกติกา', en: 'Review Information & Rules' },
    { number: 3 as const, th: 'อัปโหลดและส่งไฟล์', en: 'Upload & Submit Files' },
    { number: 4 as const, th: 'ยืนยันการส่ง', en: 'Submission Confirmation' },
  ];

  const getStatus = (step: StudentExamProgressStep): StepStatus => {
    if (allCompleted) return 'completed';
    if (errorStep === step) return 'error';
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  };

  const statusText = (status: StepStatus) => {
    if (status === 'completed') return isThai ? 'เสร็จสิ้นแล้ว' : 'completed';
    if (status === 'current') return isThai ? 'ขั้นตอนปัจจุบัน' : 'current step';
    if (status === 'error') return isThai ? 'เกิดข้อผิดพลาด' : 'error';
    return isThai ? 'ยังไม่เริ่ม' : 'not started';
  };
  const completedConnectorCount = allCompleted ? 3 : Math.max(0, currentStep - 1);

  return (
    <nav
      aria-label={isThai ? 'ความคืบหน้ากระบวนการสอบ' : 'Exam progress'}
      className="isolate min-h-[76px] cursor-default select-none border-b border-gray-200 bg-white shadow-xs"
    >
      <div className="relative mx-auto min-h-[76px] w-[calc(100%-1.5rem)] max-w-[1120px] pt-[10px] pb-0.5 sm:w-[calc(100%-3rem)]">
        <span
          aria-hidden="true"
          className="absolute left-[12.5%] right-[12.5%] top-[25px] z-0 h-0.5 bg-gray-300 md:top-[27px]"
        />
        <span
          aria-hidden="true"
          className="absolute left-[12.5%] top-[25px] z-0 h-0.5 bg-emerald-500 transition-[width] duration-300 md:top-[27px]"
          style={{ width: `${completedConnectorCount * 25}%` }}
        />

        <ol className="relative z-10 grid w-full grid-cols-4">
          {steps.map((step) => {
            const status = getStatus(step.number);
            const label = isThai ? step.th : step.en;
            const isEmphasized = status === 'current' || status === 'error';
            const circleClass = status === 'completed'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : status === 'current'
              ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-100'
              : status === 'error'
              ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100'
              : 'border-gray-300 bg-white text-gray-400';
            const labelClass = status === 'completed'
              ? 'text-emerald-700'
              : status === 'current'
              ? 'font-bold text-blue-700'
              : status === 'error'
              ? 'font-bold text-red-700'
              : 'text-gray-400';

            return (
              <li
                key={step.number}
                aria-label={isThai
                  ? `ขั้นตอนที่ ${step.number} ${label} ${statusText(status)}`
                  : `Step ${step.number}, ${label}, ${statusText(status)}`}
                aria-current={status === 'current' ? 'step' : undefined}
                className="relative z-10 flex min-w-0 flex-col items-center justify-start text-center"
              >
                <div
                  aria-hidden="true"
                  className={`relative z-20 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold md:h-[34px] md:w-[34px] ${circleClass}`}
                >
                  {status === 'completed' ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : status === 'error' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </div>

                <div
                  className={`mt-1 w-full px-1 text-center text-[11px] leading-[1.2] md:block md:text-xs ${
                    isEmphasized ? 'block' : 'sr-only md:not-sr-only'
                  } ${labelClass}`}
                >
                  {label}
                </div>
                {status === 'current' && (
                  <div
                    title={statusMessage}
                    className="mt-px w-full truncate px-1 text-center text-[10px] font-medium leading-[1.2] text-blue-600"
                  >
                    {statusMessage || (isThai ? 'ขั้นตอนปัจจุบัน' : 'Current step')}
                  </div>
                )}
                {status === 'error' && (
                  <div
                    title={statusMessage}
                    className="mt-px w-full truncate px-1 text-center text-[10px] font-medium leading-[1.2] text-red-600"
                  >
                    {statusMessage || (isThai ? 'เกิดข้อผิดพลาด' : 'Action required')}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {statusMessage && <span className="sr-only" role={errorStep ? 'alert' : 'status'}>{statusMessage}</span>}
      </div>
    </nav>
  );
};
