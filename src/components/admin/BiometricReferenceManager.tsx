import { calculateYearLevelFromAdmissionYear } from '../../utils/academicYear';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Eye,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Student } from '../../types';

export const BiometricReferenceManager: React.FC = () => {
  const { students, triggerBiometricRetake, showToast, language } = useApp();
  const isThai = language === 'th';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [retakeReason, setRetakeReason] = useState(
    isThai
      ? 'แสงไม่เพียงพอหรือใบหน้าถูกบดบังในภาพถ่ายตั้งต้น'
      : 'Poor lighting or facial occlusion in original capture'
  );
  const [matchingThreshold, setMatchingThreshold] = useState(85);

  const term = searchTerm.toLowerCase();
  const filteredStudents = students.filter(
    (s) =>
      (s.fullName || '').toLowerCase().includes(term) ||
      (s.studentCode || '').toLowerCase().includes(term) ||
      (s.department || '').toLowerCase().includes(term)
  );

  const handleTriggerRetake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    triggerBiometricRetake(selectedStudent.id, retakeReason);
    setSelectedStudent(null);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'ข้อมูลชีวมิติ & การยืนยันตัวตน (A6 & A7)' : 'Biometrics & Identity (A6 & A7)'}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {isThai ? 'จัดการข้อมูลใบหน้าชีวมิติ' : 'Biometric Reference Management'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isThai
              ? 'ตรวจสอบเทมเพลตใบหน้าที่ลงทะเบียนของผู้เข้าสอบ ปรับเกณฑ์ความแม่นยำในการเปรียบเทียบ และสั่งการถ่ายภาพใบหน้าใหม่'
              : 'Audit enrolled examinee facial templates, adjust match verification thresholds, and issue mandatory photo retake directives.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {students.filter((s) => s.faceReferenceUrl).length} / {students.length}{' '}
              {isThai ? 'เทมเพลตพร้อมใช้งาน' : 'Templates Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
        <input
          type="text"
          placeholder={
            isThai
              ? 'ค้นหานักศึกษาด้วยชื่อ, รหัสนักศึกษา หรือสาขาวิชา...'
              : 'Search students by name, ID code, or department...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Examinee Biometric Roster Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3.5">{isThai ? 'ข้อมูลผู้เข้าสอบ' : 'Examinee Details'}</th>
                <th className="px-4 py-3.5">{isThai ? 'รหัสนักศึกษา' : 'Student Code'}</th>
                <th className="px-4 py-3.5">{isThai ? 'สถานะชีวมิติ' : 'Biometric Status'}</th>
                <th className="px-4 py-3.5">{isThai ? 'คุณภาพภาพต้นแบบ' : 'Reference Quality'}</th>
                <th className="px-4 py-3.5">{isThai ? 'รูปแบบการตรวจสอบ' : 'Verification Mode'}</th>
                <th className="px-6 py-3.5 text-right">{isThai ? 'การจัดการ' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((std) => (
                <tr key={std.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                        {std.faceReferenceUrl ? (
                          <img
                            src={std.faceReferenceUrl}
                            alt={std.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                            {std.fullName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{std.fullName}</div>
                        <div className="text-gray-500 text-[11px]">{std.department}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 font-mono font-medium text-gray-800">
                    {std.studentCode}
                  </td>

                  <td className="px-4 py-3.5">
                    {std.faceReferenceUrl ? (
                      <Badge variant="success" size="sm">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isThai ? 'ลงทะเบียนแล้ว' : 'Template Enrolled'}</span>
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        <span>{isThai ? 'ต้องถ่ายใหม่ / รอทำ ST2B' : 'Retake / Pending ST2B'}</span>
                      </Badge>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    {std.faceReferenceUrl ? (
                      <span className="font-mono text-emerald-700 font-semibold">
                        98.4% {isThai ? 'ดัชนีความตรงกัน' : 'Match Index'}
                      </span>
                    ) : (
                      <span className="text-gray-400">{isThai ? 'ยังไม่บันทึก' : 'Not Captured'}</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-gray-500">
                    {isThai ? 'โครงสร้างใบหน้า (เซนเซอร์ในเครื่อง)' : 'Facial Geometry (Local Sensor)'}
                  </td>

                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedStudent(std)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      {isThai ? 'ตรวจสอบ / สั่งถ่ายใหม่' : 'Audit / Retake'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BIOMETRIC DETAIL & RETAKE MODAL (Screen A7) */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={
          isThai
            ? `ตรวจสอบข้อมูลใบหน้าชีวมิติ: ${selectedStudent?.fullName}`
            : `Biometric Reference Audit: ${selectedStudent?.fullName}`
        }
        maxWidth="lg"
      >
        {selectedStudent && (
          <div className="space-y-4 text-left text-xs">
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-200 border-2 border-gray-300 shrink-0 mx-auto sm:mx-0">
                {selectedStudent.faceReferenceUrl ? (
                  <img
                    src={selectedStudent.faceReferenceUrl}
                    alt={selectedStudent.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">
                    {isThai ? 'ไม่มีภาพต้นแบบ' : 'No Reference Stored'}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">{selectedStudent.fullName}</h3>
                  <Badge variant={selectedStudent.faceReferenceUrl ? 'success' : 'warning'}>
                    {selectedStudent.faceReferenceUrl
                      ? isThai ? 'ภาพต้นแบบใช้งานได้' : 'Active Reference'
                      : isThai ? 'จำเป็นต้องถ่ายใหม่' : 'Retake Required'}
                  </Badge>
                </div>
                <div className="text-gray-500 font-mono">
                  {isThai ? 'รหัส: ' : 'ID: '}
                  {selectedStudent.studentCode}
                </div>
                <div className="text-gray-600">
                  {isThai ? 'สาขาวิชา: ' : 'Department: '}
                  {selectedStudent.department} • {isThai ? 'ชั้นปีที่ ' : 'Year '}
                  {selectedStudent.admissionYear ? calculateYearLevelFromAdmissionYear(selectedStudent.admissionYear).yearLevel || '—' : '—'}
                </div>
                <div className="pt-2 text-[11px] text-gray-500 border-t border-gray-200">
                  {isThai
                    ? 'เทมเพลตที่ลงทะเบียนจะถูกเปรียบเทียบกับภาพกล้องสดขณะล็อกอินหน้าจอ ST2C'
                    : 'Enrolled template is verified against live camera video feed on login screen ST2C.'}
                </div>
              </div>
            </div>

            {/* Threshold adjustment */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900">
                  {isThai ? 'เกณฑ์ความตรงกันในการตรวจสอบ (Threshold)' : 'Verification Match Threshold'}
                </span>
                <span className="font-mono font-bold text-blue-700">{matchingThreshold}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="95"
                value={matchingThreshold}
                onChange={(e) => setMatchingThreshold(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-blue-600">
                <span>{isThai ? 'ยืดหยุ่น (60%)' : 'Relaxed (60%)'}</span>
                <span>{isThai ? 'มาตรฐานแนะนำ (85%)' : 'Recommended Standard (85%)'}</span>
                <span>{isThai ? 'เข้มงวดสูงสุด (95%)' : 'Strict Security (95%)'}</span>
              </div>
            </div>

            {/* Mandatory Retake Request Trigger */}
            <form onSubmit={handleTriggerRetake} className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>{isThai ? 'ออกคำสั่งบังคับถ่ายภาพใบหน้าใหม่' : 'Issue Mandatory Biometric Retake Directive'}</span>
              </div>
              <p className="text-[11px] text-amber-800">
                {isThai ? (
                  <>
                    การสั่งถ่ายใหม่จะลบเทมเพลตเดิม และจะนำนักศึกษาเข้าสู่{' '}
                    <strong>หน้าจอ ST2B (ลงทะเบียนใบหน้า)</strong> โดยอัตโนมัติเมื่อเข้าสู่ระบบครั้งถัดไป
                  </>
                ) : (
                  <>
                    Triggering a retake clears this template and will automatically redirect the student into{' '}
                    <strong>Screen ST2B (Face Enrollment)</strong> on their next sign-in.
                  </>
                )}
              </p>

              <div>
                <label className="block text-amber-900 font-semibold mb-1">
                  {isThai ? 'เหตุผลทางธุรการ / ข้อบกพร่อง:' : 'Administrative Reason:'}
                </label>
                <input
                  type="text"
                  required
                  value={retakeReason}
                  onChange={(e) => setRetakeReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isThai ? 'ยืนยันคำสั่งถ่ายภาพใหม่' : 'Execute Retake Request'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
};
