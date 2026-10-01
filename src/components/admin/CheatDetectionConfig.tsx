import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Eye,
  AppWindow,
  Globe,
  Users,
  Search,
  Bell,
  Check
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { CheatDetectionRules } from '../../types';

const defaultRules: CheatDetectionRules = {
  multipleFaceDetection: true,
  lookingAwayDetection: true,
  lookingAwayThresholdSeconds: 4,
  windowSwitchDetection: true,
  allowedWindowSwitches: 1,
  urlWhitelistEnforcement: true,
};

export const CheatDetectionConfig: React.FC = () => {
  const {
    securityRules,
    updateSecurityRules,
    violations,
    acknowledgeViolation,
    students,
    showToast,
    language,
  } = useApp();
  const isThai = language === 'th';

  // Local state initialized with fallback
  const [config, setConfig] = useState<CheatDetectionRules>(() => securityRules || defaultRules);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Keep state in sync if context updates
  useEffect(() => {
    if (securityRules) {
      setConfig(securityRules);
    }
  }, [securityRules]);

  const handleToggle = (key: keyof CheatDetectionRules) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSecurityRules(config);
    showToast(
      isThai ? 'บันทึกกฎระเบียบแล้ว' : 'Rules Saved',
      isThai
        ? 'อัปเดตนโยบายเซนเซอร์ตรวจจับการทุจริตไปยังเครื่องคอมพิวเตอร์ทุกห้องสอบแล้ว'
        : 'Anti-cheating neural sensor policies updated across all lab workstations.',
      'success'
    );
  };

  const filteredViolations = violations.filter((v) => {
    if (filterType !== 'all' && v.type !== filterType) return false;
    const s = searchTerm.toLowerCase();
    const std = students.find((std) => std.id === v.studentId);
    return (
      (v.seatNo || '').toLowerCase().includes(s) ||
      (v.detail || '').toLowerCase().includes(s) ||
      (std?.fullName || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'ระบบคุมสอบอัตโนมัติ (A8 & A9)' : 'Automated Proctoring (A8 & A9)'}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {isThai ? 'ความปลอดภัย & กฎการตรวจจับการทุจริต' : 'Cheat Detection & Security Rules'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isThai
              ? 'ปรับเกณฑ์ตรวจจับวิทัศน์คอมพิวเตอร์ (Computer Vision), เซนเซอร์สลับหน้าต่าง, รายชื่อเว็บไซต์ที่อนุญาต และตรวจสอบเหตุการณ์'
              : 'Tune computer vision thresholds, window focus sensors, network whitelists, and review logged infractions.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="danger" size="md">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {violations.filter((v) => !v.acknowledged).length}{' '}
              {isThai ? 'รายการรอการตรวจสอบ' : 'Pending Review'}
            </span>
          </Badge>
        </div>
      </div>

      {/* SECTION 1: Detection Engine Rules Configuration (A8) */}
      <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">
              {isThai ? 'พารามิเตอร์การตรวจจับอัตโนมัติ' : 'Neural Detection Parameters'}
            </h2>
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
          >
            {isThai ? 'ใช้นโยบายนี้กับทุกห้องสอบ' : 'Apply Policy to All Rooms'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Rule 1: Multiple Faces */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{isThai ? 'ตรวจพบใบหน้าหลายคนในกล้อง' : 'Multiple Faces in Camera'}</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(config?.multipleFaceDetection)}
                onChange={() => handleToggle('multipleFaceDetection')}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-gray-500 text-[11px]">
              {isThai
                ? 'ส่งสัญญาณเตือนการละเมิดทันทีเมื่อมีบุคคลอื่นหรือผู้สัญจรเข้ามาในมุมกล้องเว็บแคม'
                : 'Triggers ST8 violation if a secondary person or bystander enters the workstation webcam angle.'}
            </p>
          </div>

          {/* Rule 2: Looking Away */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>{isThai ? 'ตรวจจับการหันหน้า / มองออกนอกจอ' : 'Head Pose / Looking Away Alert'}</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(config?.lookingAwayDetection)}
                onChange={() => handleToggle('lookingAwayDetection')}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-gray-600 text-[11px]">
                <span>{isThai ? 'ความไวระยะเวลาที่เบี่ยงเบน:' : 'Deviation Sensitivity:'}</span>
                <span className="font-mono font-bold text-blue-600">
                  {config?.lookingAwayThresholdSeconds ?? 4} {isThai ? 'วินาที' : 'Seconds'}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                value={config?.lookingAwayThresholdSeconds ?? 4}
                onChange={(e) =>
                  setConfig({ ...config, lookingAwayThresholdSeconds: Number(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Rule 3: Window Defocus */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 flex items-center gap-2">
                <AppWindow className="w-4 h-4 text-blue-600" />
                <span>{isThai ? 'การสลับแอปพลิเคชัน / หลุดโฟกัสจอ' : 'Application Switching / Defocus'}</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(config?.windowSwitchDetection)}
                onChange={() => handleToggle('windowSwitchDetection')}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-gray-600 text-[11px]">
                <span>{isThai ? 'จำนวนครั้งที่อนุญาตให้กดสลับจอ (Alt-Tab):' : 'Max Tolerated Alt-Tab switches:'}</span>
                <span className="font-mono font-bold text-blue-600">
                  {config?.allowedWindowSwitches ?? 1} {isThai ? 'ครั้ง' : 'Switch'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                value={config?.allowedWindowSwitches ?? 1}
                onChange={(e) =>
                  setConfig({ ...config, allowedWindowSwitches: Number(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Rule 4: URL Whitelist */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>{isThai ? 'บังคับใช้รายชื่อเว็บไซต์ที่อนุญาต (Whitelist)' : 'Website Whitelist Enforcement'}</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(config?.urlWhitelistEnforcement)}
                onChange={() => handleToggle('urlWhitelistEnforcement')}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <div className="text-[11px] text-gray-600 font-mono bg-white p-2 rounded-lg border border-gray-200">
              {isThai ? 'เว็บไซต์ที่อนุญาต: ' : 'Permitted: '}*.icit.university.ac.th, python.org/docs
            </div>
          </div>
        </div>
      </form>

      {/* SECTION 2: Incident Violation Log & Acknowledgment (A9) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isThai ? 'รายการเหตุการณ์การละเมิดระหว่างสอบ (A9)' : 'Exam Incident Violation Feed (A9)'}
            </h2>
            <p className="text-xs text-gray-500">
              {isThai
                ? 'การแจ้งเตือนแบบเรียลไทม์ที่ได้รับจากเซนเซอร์บนคอมพิวเตอร์ห้องปฏิบัติการ'
                : 'Real-time infractions reported by laboratory workstation telemetry sensors'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{isThai ? 'การละเมิดทุกประเภท' : 'All Infraction Types'}</option>
              <option value="multiple_faces">{isThai ? 'ตรวจพบหลายใบหน้า' : 'Multiple Faces'}</option>
              <option value="looking_away">{isThai ? 'มองออกนอกจอ' : 'Looking Away'}</option>
              <option value="window_switch">{isThai ? 'สลับหน้าจอ' : 'Window Switch'}</option>
              <option value="unauthorized_site">{isThai ? 'เข้าเว็บไซต์ที่ไม่อนุญาต' : 'Unauthorized Site'}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3.5">{isThai ? 'ที่นั่ง & ผู้เข้าสอบ' : 'Seat & Student'}</th>
                <th className="px-4 py-3.5">{isThai ? 'ประเภทการละเมิด' : 'Violation Category'}</th>
                <th className="px-4 py-3.5">{isThai ? 'รายละเอียด' : 'Detail Description'}</th>
                <th className="px-4 py-3.5">{isThai ? 'เวลาที่ตรวจพบ' : 'Detection Timestamp'}</th>
                <th className="px-4 py-3.5">{isThai ? 'สถานะ' : 'Status'}</th>
                <th className="px-6 py-3.5 text-right">{isThai ? 'การจัดการของผู้คุมสอบ' : 'Proctor Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredViolations.map((vio) => {
                const std = students.find((s) => s.id === vio.studentId);
                return (
                  <tr key={vio.id} className="hover:bg-red-50/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-gray-900">
                        {isThai ? 'ที่นั่ง ' : 'Seat '}
                        {vio.seatNo} — {std?.fullName || (isThai ? 'ผู้เข้าสอบ' : 'Examinee')}
                      </div>
                      <div className="text-gray-500 font-mono text-[11px]">{std?.studentCode}</div>
                    </td>

                    <td className="px-4 py-3.5 uppercase font-mono font-semibold text-red-700">
                      {vio.type.replace('_', ' ')}
                    </td>

                    <td className="px-4 py-3.5 text-gray-700 max-w-xs">
                      {vio.detail}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-gray-500">
                      {vio.detectedAt}
                    </td>

                    <td className="px-4 py-3.5">
                      {vio.acknowledged ? (
                        <Badge variant="neutral" size="sm">{isThai ? 'รับทราบแล้ว' : 'Acknowledged'}</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">{isThai ? 'รอดำเนินการ' : 'Flagged Pending'}</Badge>
                      )}
                    </td>

                    <td className="px-6 py-3.5 text-right">
                      {!vio.acknowledged ? (
                        <button
                          onClick={() => acknowledgeViolation(vio.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          {isThai ? 'รับทราบ' : 'Acknowledge'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium">
                          {isThai ? 'ปิดเรื่องแล้ว' : 'Dismissed'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
