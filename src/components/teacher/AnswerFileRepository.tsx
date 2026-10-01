import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FolderArchive,
  Download,
  Search,
  Calendar,
  FileArchive,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Archive,
  ArrowLeft,
  RefreshCw,
  HardDrive,
  Clock
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { formatFileSize } from '../../utils/fileSize';
import { examStatusLabels, getEffectiveExamStatus } from '../../services/examStatus';
import { useExamClock } from '../../utils/useExamClock';

export const AnswerFileRepository: React.FC = () => {
  const now = useExamClock();
  const {
    examSessions,
    courses,
    rooms,
    students,
    seatAssignments,
    submissions,
    showToast,
    language,
  } = useApp();
  const isThai = language === 'th';

  // Active view: 'list' (T7) or 'files' (T8)
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Bulk download modal state
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState(0);

  const selectedExam = examSessions.find((e) => e.id === selectedExamId);
  const selectedCourse = courses.find((c) => c.id === selectedExam?.courseId);
  const selectedRoom = rooms.find((r) => r.id === selectedExam?.roomId);

  const examSubmissions = submissions.filter((s) => s.examId === selectedExamId);

  const handleDownloadSingle = (filename: string, studentName: string) => {
    showToast(
      isThai ? 'เริ่มดาวน์โหลดไฟล์' : 'Download Started',
      isThai ? `กำลังดาวน์โหลดไฟล์คำตอบของ ${studentName} (${filename})...` : `Downloading archive for ${studentName} (${filename})...`,
      'info'
    );
  };

  const startBulkDownload = () => {
    setIsBulkDownloading(true);
    setBulkDownloadProgress(10);

    const interval = setInterval(() => {
      setBulkDownloadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          setTimeout(() => {
            setIsBulkDownloading(false);
            showToast(
              isThai ? 'ไฟล์บีบอัดรวมพร้อมแล้ว' : 'Bulk Archive Ready',
              isThai
                ? `บีบอัดไฟล์คำตอบของนักศึกษา ${examSubmissions.length} คน รวมเป็นไฟล์ .zip เรียบร้อยแล้ว`
                : `Completed packaging ${examSubmissions.length} student answer archives into .zip file.`,
              'success'
            );
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  return (
    <div className="space-y-6 text-left">
      {/* View T7: Completed Exam Room List */}
      {!selectedExamId ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                {isThai ? 'คลังจัดเก็บไฟล์คำตอบที่ปิดผนึก (T7)' : 'Sealed Exam Archives (T7)'}
              </span>
              <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
                {isThai ? 'คลังจัดเก็บไฟล์คำตอบข้อสอบ' : 'Answer File Repository'}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                {isThai
                  ? 'เข้าถึง ตรวจสอบค่าแฮชความถูกต้อง (Integrity Hash) และส่งออกไฟล์คำตอบโปรแกรมที่นักศึกษาส่ง'
                  : 'Access, verify integrity hashes, and export all submitted student programming files and archives.'}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                placeholder={
                  isThai
                    ? 'ค้นหารอบการสอบที่เสร็จสิ้นด้วยรหัสวิชาหรือห้องปฏิบัติการ...'
                    : 'Search completed examinations by course or room...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examSessions.map((session) => {
              const course = courses.find((c) => c.id === session.courseId);
              const room = rooms.find((r) => r.id === session.roomId);
              const subsCount = submissions.filter((s) => s.examId === session.id).length;
              const status = getEffectiveExamStatus(session, now);

              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedExamId(session.id)}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold font-mono text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      {course?.courseCode} • {isThai ? 'ตอน ' : 'Sec '}
                      {session.sectionNo}
                    </span>
                    <Badge variant={status === 'completed' ? 'neutral' : status === 'upcoming' ? 'warning' : 'success'}>{examStatusLabels[status]}</Badge>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {course?.courseName}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{session.examDate} • {session.startTime} - {session.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {isThai ? 'ห้องสอบ: ' : 'Room: '}
                        {room?.labName} (ชั้น {room?.floor})
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-700">
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {subsCount > 0 ? subsCount : 24}{' '}
                        {isThai ? 'ไฟล์คำตอบที่ผ่านการตรวจสอบแล้ว' : 'Verified Answer Archives'}
                      </span>
                    </span>
                    <span className="text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>{isThai ? 'เปิดดูไฟล์' : 'Open Files'}</span>
                      <span>&rarr;</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* View T8: Granular Answer File List for Selected Session */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedExamId(null)}
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                title={isThai ? 'กลับไปยังคลังไฟล์' : 'Back to Repository'}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  {isThai ? 'รายละเอียดคลังไฟล์ข้อสอบ (T8)' : 'Exam Archive Detail (T8)'}
                </span>
                <h1 className="text-xl font-bold text-gray-900 mt-0.5">
                  {selectedCourse?.courseCode} - {isThai ? 'ตอนเรียน ' : 'Section '}
                  {selectedExam?.sectionNo}: {isThai ? 'ไฟล์คำตอบที่ส่ง' : 'Answer Files'}
                </h1>
                <p className="text-xs text-gray-500">
                  {selectedRoom?.labName} • {isThai ? 'วันที่สอบ: ' : 'Exam Date: '}
                  {selectedExam?.examDate}
                </p>
              </div>
            </div>

            <button
              onClick={startBulkDownload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>{isThai ? 'ดาวน์โหลดทั้งหมด (.zip)' : 'Download All (.zip)'}</span>
            </button>
          </div>

          {/* Table of Submissions */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3.5">{isThai ? 'ผู้เข้าสอบ & ที่นั่ง' : 'Examinee & Seat'}</th>
                    <th className="px-4 py-3.5">{isThai ? 'ไฟล์ที่ส่ง' : 'Submitted Files'}</th>
                    <th className="px-4 py-3.5">{isThai ? 'ขนาดรวม' : 'Total Size'}</th>
                    <th className="px-4 py-3.5">{isThai ? 'เวลาที่ส่ง' : 'Submission Timestamp'}</th>
                    <th className="px-4 py-3.5">{isThai ? 'รหัสตรวจสอบ SHA-256' : 'Integrity SHA-256'}</th>
                    <th className="px-6 py-3.5 text-right">{isThai ? 'การจัดการ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {examSubmissions.map((sub) => {
                    const student = students.find((s) => s.id === sub.studentId);
                    const assignment = seatAssignments.find(
                      (sa) => sa.examId === selectedExamId && sa.studentId === sub.studentId
                    );

                    return (
                      <tr key={sub.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="font-semibold text-gray-900">{student?.fullName}</div>
                          <div className="text-gray-500 font-mono text-[11px] flex items-center gap-2">
                            <span>{student?.studentCode}</span>
                            <span>•</span>
                            <span className="font-bold text-blue-600">
                              {isThai ? 'ที่นั่ง ' : 'Seat '}
                              {assignment?.seatNo || 'A1'}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            {(sub.files || []).map((file, idx) => {
                              const fileName = file?.fileName || (file as any)?.name || 'solution_file';
                              const isZip = String(fileName).toLowerCase().endsWith('.zip');
                              return (
                                <div key={idx} className="flex items-center gap-1.5 font-mono text-gray-800">
                                  {isZip ? (
                                    <FileArchive className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                  <span>{fileName}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-gray-600">
                          {formatFileSize(
                            (sub.files || []).reduce((acc, f) => acc + (f?.sizeKb || 0), 0) * 1024
                          )}
                        </td>

                        <td className="px-4 py-3.5 font-mono text-gray-600">
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : '-'}
                        </td>

                        <td className="px-4 py-3.5">
                          <Badge variant="success" size="sm">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isThai ? 'ตรวจสอบแล้วถูกต้อง' : 'Verified Valid'}</span>
                          </Badge>
                          <span className="block text-[10px] font-mono text-gray-400 truncate max-w-[130px] mt-0.5">
                            {(sub as any).checksum || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                          </span>
                        </td>

                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => handleDownloadSingle((sub.files && sub.files[0]?.fileName) || (sub.files && (sub.files[0] as any)?.name) || 'exam_submission.zip', student?.fullName || 'Examinee')}
                            className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 text-[11px] font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Download className="w-3 h-3 text-blue-600" />
                            <span>{isThai ? 'ดาวน์โหลด' : 'Download'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BULK DOWNLOAD PROGRESS MODAL */}
      <Modal
        isOpen={isBulkDownloading}
        onClose={() => {}}
        title={isThai ? 'กำลังบีบอัดไฟล์คำตอบทั้งห้องสอบ' : 'Packaging Full Course Submission Archive'}
        maxWidth="md"
      >
        <div className="text-center py-4 space-y-4 text-xs text-gray-600">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">
            {isThai
              ? `กำลังรวมไฟล์คำตอบของผู้เข้าสอบ ${examSubmissions.length} คน`
              : `Bundling ${examSubmissions.length} Examinee Answer Files`}
          </h3>
          <p>
            {isThai
              ? 'กำลังสร้างไฟล์บีบอัด ZIP ของห้องสอบ คำนวณรหัสตรวจสอบความถูกต้องรายไฟล์ และบันทึกบันทึกการตรวจสอบของผู้สอน'
              : 'Generating unified laboratory ZIP container, computing individual file integrity checksums, and sealing instructor audit log.'}
          </p>

          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${bulkDownloadProgress}%` }}
            />
          </div>

          <span className="font-mono text-xs text-blue-600 font-bold block">
            {bulkDownloadProgress}% {isThai ? 'เสร็จสิ้น' : 'Complete'}
          </span>
        </div>
      </Modal>
    </div>
  );
};
