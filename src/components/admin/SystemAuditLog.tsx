import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Shield,
  Eye,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { AuditLogEntry } from '../../types';

export const SystemAuditLog: React.FC = () => {
  const { auditLogs, showToast, language } = useApp();
  const isThai = language === 'th';

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const filteredLogs = auditLogs.filter((log) => {
    if (roleFilter !== 'all' && log.role !== roleFilter) return false;
    const s = searchTerm.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(s) ||
      (log.performedBy || '').toLowerCase().includes(s) ||
      (log.target || '').toLowerCase().includes(s) ||
      (log.ip || '').includes(s)
    );
  });

  const handleExportCSV = () => {
    showToast(
      isThai ? 'เริ่มการส่งออกข้อมูล' : 'Export Initiated',
      isThai
        ? `กำลังรวบรวมบันทึกตรวจสอบ ${filteredLogs.length} รายการเป็นไฟล์ SecureLab_Audit_${Date.now()}.csv`
        : `Packaging ${filteredLogs.length} audit records into SecureLab_Audit_${Date.now()}.csv`,
      'success'
    );
  };

  const getRoleBadgeLabel = (role: string) => {
    if (!isThai) return role;
    if (role === 'Teacher') return 'อาจารย์ / ผู้คุมสอบ';
    if (role === 'Admin') return 'ผู้ดูแลระบบ';
    if (role === 'System') return 'ระบบอัตโนมัติ';
    return role;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'ความสอดคล้องตามมาตรฐาน & การตรวจสอบย้อนหลัง (A10 & A11)' : 'Compliance & Traceability (A10 & A11)'}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {isThai ? 'บันทึกการตรวจสอบระบบ' : 'System Audit Log'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isThai
              ? 'ประวัติที่ไม่สามารถแก้ไขได้ของการควบคุมเวลา, การเปลี่ยนสถานะบัญชี, การจัดที่นั่งใหม่ และความสมบูรณ์ของไฟล์คำตอบ'
              : 'Immutable trace of time controls, account status changes, seating reassignments, and file integrity operations.'}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>{isThai ? 'ส่งออกบันทึกตรวจสอบ (.csv)' : 'Export Audit Log (.csv)'}</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-600">{isThai ? 'กรองตามบทบาท:' : 'Filter by Role:'}</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{isThai ? 'ทุกบทบาท' : 'All Roles'}</option>
            <option value="Teacher">{isThai ? 'การกระทำของอาจารย์ / ผู้คุมสอบ' : 'Teacher / Proctor Actions'}</option>
            <option value="Admin">{isThai ? 'การกระทำของผู้ดูแลระบบ' : 'Administrator Actions'}</option>
            <option value="System">{isThai ? 'การทำงานอัตโนมัติของระบบ' : 'Automated System Triggers'}</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder={isThai ? 'ค้นหากิจกรรม, ผู้ใช้, หรือ IP...' : 'Search action, user, or IP...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3.5">{isThai ? 'เวลา' : 'Timestamp'}</th>
                <th className="px-4 py-3.5">{isThai ? 'การกระทำที่ดำเนินการ' : 'Action Executed'}</th>
                <th className="px-4 py-3.5">{isThai ? 'ผู้ดำเนินการ' : 'Authorized User'}</th>
                <th className="px-4 py-3.5">{isThai ? 'บทบาท' : 'Role'}</th>
                <th className="px-4 py-3.5">{isThai ? 'เป้าหมาย' : 'Target Entity'}</th>
                <th className="px-4 py-3.5">{isThai ? 'หมายเลข IP เครื่อง' : 'Workstation IP'}</th>
                <th className="px-4 py-3.5">{isThai ? 'สถานะ' : 'Status'}</th>
                <th className="px-6 py-3.5 text-right">{isThai ? 'รายละเอียด' : 'Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-3.5 font-mono text-gray-600 whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  <td className="px-4 py-3.5 font-semibold text-gray-900">
                    {log.action}
                  </td>

                  <td className="px-4 py-3.5 text-gray-700 font-medium">
                    {log.performedBy}
                  </td>

                  <td className="px-4 py-3.5">
                    <Badge
                      variant={log.role === 'Admin' ? 'danger' : log.role === 'Teacher' ? 'purple' : 'neutral'}
                      size="sm"
                    >
                      {getRoleBadgeLabel(log.role)}
                    </Badge>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-gray-600">
                    {log.target}
                  </td>

                  <td className="px-4 py-3.5 font-mono text-gray-500">
                    {log.ip}
                  </td>

                  <td className="px-4 py-3.5">
                    <Badge variant={log.status === 'success' ? 'success' : 'danger'} size="sm">
                      {log.status === 'success' ? (isThai ? 'สำเร็จ' : 'success') : (isThai ? 'ล้มเหลว' : 'failure')}
                    </Badge>
                  </td>

                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                      title={isThai ? 'ตรวจสอบบันทึก' : 'Inspect record'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT LOG MODAL */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={isThai ? 'บันทึกความสมบูรณ์ของการตรวจสอบ (Integrity Record)' : 'Audit Log Integrity Record'}
        maxWidth="md"
      >
        {selectedLog && (
          <div className="space-y-3 text-left text-xs">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">{isThai ? 'รหัสธุรกรรม (Transaction ID):' : 'Transaction ID:'}</span>
                <span className="font-mono text-gray-900 font-bold">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isThai ? 'วันเวลา:' : 'Timestamp:'}</span>
                <span className="font-mono text-gray-900">{selectedLog.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isThai ? 'การกระทำที่ดำเนินการ:' : 'Executed Action:'}</span>
                <span className="font-semibold text-blue-700">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isThai ? 'หมายเลข IP ต้นทาง:' : 'Origin IP:'}</span>
                <span className="font-mono text-gray-900">{selectedLog.ip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isThai ? 'ผู้ดำเนินการ:' : 'Actor:'}</span>
                <span className="text-gray-900 font-medium">
                  {selectedLog.performedBy} ({getRoleBadgeLabel(selectedLog.role)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isThai ? 'เป้าหมาย:' : 'Target Entity:'}</span>
                <span className="font-mono text-gray-900">{selectedLog.target}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-[11px]">
              {isThai
                ? 'ลงลายมือชื่อดิจิทัลเข้ารหัสด้วย ICIT HMAC ของสถาบันเพื่อตรวจจับการแก้ไขดัดแปลงทางนิติวิทยาศาสตร์'
                : 'Cryptographically signed with institutional ICIT HMAC for forensic tamper detection.'}
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-white font-semibold text-xs hover:bg-gray-900 cursor-pointer"
              >
                {isThai ? 'ปิดหน้าต่าง' : 'Close Record'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
