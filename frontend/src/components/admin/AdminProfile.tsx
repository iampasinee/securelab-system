import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  UserCheck,
  Server,
  Database,
  RefreshCw,
  LogOut,
  Radio,
  HardDrive,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const AdminProfile: React.FC = () => {
  const { setRole, showToast, resetData, language } = useApp();
  const isThai = language === 'th';

  const handleBackup = () => {
    showToast(
      isThai ? 'สร้างสแนปช็อตฐานข้อมูลแล้ว' : 'Database Snapshot Created',
      isThai
        ? 'สำรองข้อมูลคลาวด์เข้ารหัสอัตโนมัติไปยังที่เก็บข้อมูลถาวร ICIT ปลอดภัยแล้ว'
        : 'Automated cloud snapshot backed up to secure ICIT cold storage.',
      'success'
    );
  };

  const handleBroadcast = () => {
    showToast(
      isThai ? 'ส่งข้อความบรอดคาสต์แล้ว' : 'Broadcast Sent',
      isThai
        ? 'ส่งข้อความด่วน: "ผู้คุมสอบจะเข้าตรวจใน 5 นาที" ไปยังคอมพิวเตอร์ทั้ง 40 เครื่องแล้ว'
        : 'Sent priority message: "Proctor inspection in 5 minutes" to all 40 workstations.',
      'info'
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-left">
      <div className="pb-4 border-b border-gray-200">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
          {isThai ? 'บัญชีผู้ดูแลระบบสูงสุด (A12)' : 'Super-Admin Account (A12)'}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
          {isThai ? 'ข้อมูลผู้ดูแลระบบ (Admin Profile)' : 'System Administrator Profile'}
        </h1>
        <p className="text-xs text-gray-500">
          {isThai
            ? 'สิทธิ์ความปลอดภัยระดับรูท (Root), การบำรุงรักษาฐานข้อมูล และการควบคุมการสื่อสารห้องปฏิบัติการ'
            : 'Root security permissions, database maintenance operations, and laboratory telecommunication overrides.'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-red-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Dr. Pravit Chaiyaporn</h2>
              <Badge variant="danger" size="sm">
                <Shield className="w-3 h-3" />
                <span>{isThai ? 'ผู้ดูแลระบบสูงสุด' : 'Super Administrator'}</span>
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              {isThai ? 'รหัสบุคลากร: ' : 'Staff Code: '}
              ADM-1001 • pravit.c@icit.university.ac.th
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-gray-500 block mb-1 font-medium">
              {isThai ? 'หน่วยงาน / สังกัด' : 'Department Division'}
            </span>
            <span className="font-semibold text-gray-900 text-sm">
              {isThai ? 'สำนักบริการคอมพิวเตอร์และเทคโนโลยีสารสนเทศ (ICIT)' : 'Central IT Infrastructure (ICIT)'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-gray-500 block mb-1 font-medium">
              {isThai ? 'ขอบเขตอำนาจคลัสเตอร์' : 'Cluster Authority'}
            </span>
            <span className="font-semibold text-gray-900 text-sm">
              {isThai ? 'ห้องปฏิบัติการคอมพิวเตอร์ทั้งหมดในมหาวิทยาลัย' : 'All Campus Computer Laboratories'}
            </span>
          </div>
        </div>

        {/* Maintenance Tools */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            {isThai ? 'เครื่องมือบำรุงรักษาระบบและการวินิจฉัย' : 'System Maintenance & Diagnostic Tools'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleBackup}
              className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-gray-900 text-xs group-hover:text-blue-600">
                <Database className="w-4 h-4 text-blue-600" />
                <span>{isThai ? 'จำลองการสำรองข้อมูล (Snapshot)' : 'Simulate Database Snapshot'}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {isThai
                  ? 'สั่งการสำรองข้อมูลคลาวด์เข้ารหัสสำหรับรายชื่อและไฟล์คำตอบปัจจุบัน'
                  : 'Trigger encrypted cloud backup of current rosters and answer files.'}
              </p>
            </button>

            <button
              onClick={handleBroadcast}
              className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-gray-900 text-xs group-hover:text-purple-600">
                <Radio className="w-4 h-4 text-purple-600" />
                <span>{isThai ? 'กระจายข้อความฉุกเฉิน (Broadcast)' : 'Emergency Lab Broadcast'}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {isThai
                  ? 'ส่งแบนเนอร์แจ้งเตือนด่วนไปยังหน้าจอคอมพิวเตอร์ทั้ง 40 เครื่อง'
                  : 'Push high-priority proctor banner across all 40 workstation screens.'}
              </p>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => {
              resetData();
              showToast(
                isThai ? 'รีเซ็ตข้อมูลแล้ว' : 'Reset Complete',
                isThai ? 'ชุดข้อมูลจำลองถูกรีเซ็ตกลับเป็นค่าเริ่มต้นแล้ว' : 'Local mock dataset re-initialized to default baseline.',
                'info'
              );
            }}
            className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isThai ? 'รีเซ็ตข้อมูลตัวอย่าง' : 'Reset Demo Data'}</span>
          </button>

          <button
            onClick={() => {
              showToast(
                isThai ? 'ออกจากระบบแล้ว' : 'Logged Out',
                isThai ? 'เซสชันผู้ดูแลระบบสิ้นสุดลงแล้ว' : 'Administrator session terminated.',
                'info'
              );
              setRole(null);
            }}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{isThai ? 'ออกจากระบบผู้ดูแล' : 'Sign Out of Admin Console'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
