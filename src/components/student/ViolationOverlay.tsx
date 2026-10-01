import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, AlertOctagon, Clock, User, Monitor } from 'lucide-react';

export const ViolationOverlay: React.FC = () => {
  const { activeViolationAlert, acknowledgeViolation, language } = useApp();
  const isThai = language === 'th';

  if (!activeViolationAlert) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border-2 border-red-500 text-center animate-in zoom-in-95 duration-200">
        {/* Red warning header banner */}
        <div className="bg-red-600 px-6 py-4 text-white flex items-center justify-center gap-3">
          <ShieldAlert className="w-7 h-7 text-white animate-bounce" />
          <h2 className="text-xl font-bold tracking-tight">
            {isThai ? 'ตรวจพบการละเมิดระเบียบการสอบ' : 'EXAM INTEGRITY VIOLATION DETECTED'}
          </h2>
        </div>

        <div className="p-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
            <AlertOctagon className="w-10 h-10" />
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {activeViolationAlert.type === 'unauthorized_website' &&
              (isThai ? 'ตรวจพบการเข้าถึงเว็บไซต์ที่ไม่ได้รับอนุญาต' : 'Unauthorized Website Access Detected')}
            {activeViolationAlert.type === 'duplicate_login' &&
              (isThai ? 'ตรวจพบการเข้าสู่ระบบซ้ำซ้อน' : 'Duplicate Login Detected')}
            {activeViolationAlert.type === 'unauthorized_device' &&
              (isThai ? 'ตรวจพบอุปกรณ์ที่ไม่อนุญาตเชื่อมต่อ' : 'Unauthorized Device Connected')}
            {activeViolationAlert.type === 'tab_switch' &&
              (isThai ? 'ตรวจพบการสลับแท็บเบราว์เซอร์ / ออกจากหน้าต่างสอบ' : 'Browser Tab Switch / Window Blur')}
            {activeViolationAlert.type === 'peripheral_connected' &&
              (isThai ? 'ตรวจพบอุปกรณ์จัดเก็บข้อมูลภายนอกที่ไม่ได้รับอนุญาต' : 'Unauthorized External Storage Device')}
          </h3>

          <p className="text-sm text-red-600 font-medium mb-5 bg-red-50 py-2.5 px-4 rounded-xl border border-red-100">
            {activeViolationAlert.detail}
          </p>

          <div className="grid grid-cols-2 gap-3 text-left bg-gray-50 rounded-xl p-3 mb-6 text-xs text-gray-700 border border-gray-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>
                {isThai ? 'ตรวจพบเมื่อ:' : 'Detected At:'} <strong className="font-mono">{activeViolationAlert.detectedAt}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-gray-400" />
              <span>
                {isThai ? 'ที่นั่งสอบ:' : 'Assigned Seat:'} <strong className="font-mono">{activeViolationAlert.seatNo}</strong>
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-6 leading-relaxed">
            {isThai
              ? 'เหตุการณ์นี้ได้รับการบันทึกในบันทึกการตรวจสอบแบบเรียลไทม์ของอาจารย์ผู้คุมสอบพร้อมที่อยู่ MAC & IP ของเครื่องแล้ว โปรดกลับไปยังหน้าต่างการสอบที่ได้รับอนุญาตทันทีเพื่อป้องกันการถูกตัดสิทธิ์สอบ'
              : 'This incident has been logged in the proctor’s real-time audit feed with your MAC & IP address. Please immediately return to your authorized examination window to prevent disciplinary disqualification.'}
          </div>

          <button
            onClick={() => acknowledgeViolation(activeViolationAlert.id)}
            className="w-full py-3 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md hover:shadow-lg transition-all focus:outline-hidden focus:ring-4 focus:ring-red-200 cursor-pointer"
          >
            {isThai ? 'รับทราบและกลับสู่การสอบ' : 'I Acknowledge and Return to Exam'}
          </button>
        </div>
      </div>
    </div>
  );
};
