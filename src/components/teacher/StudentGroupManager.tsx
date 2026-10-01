import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Layers3, Search, UserCheck, UserPlus, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { searchStudentsByIdentity, sectionIdOf, studentMatchesSection } from '../../services/courseState';
import { calculateYearLevelFromAdmissionYear, getAdmissionCode } from '../../utils/academicYear';
import { AccountStatusBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import type { Course, Section, Student } from '../../types';

type RosterFilter = 'all' | 'cohort' | 'individual';

export const StudentGroupManager: React.FC = () => {
  const { academicState, courses, currentTeacher, students, studentDirectory, teachers, addStudentToSection, moveStudentBetweenSections, findStudentSectionInCourse } = useApp();
  const [courseId, setCourseId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'move' | null>(null);
  const [movingStudentId, setMovingStudentId] = useState('');
  const [moveSourceId, setMoveSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [error, setError] = useState('');

  // The context has already limited Courses and Sections to this teacher's assignments.
  const selectedCourse = courses.find((course) => course.id === courseId);
  const assignments = selectedCourse?.sections.map((section) => ({ section, id: sectionIdOf(selectedCourse.id, section) })) || [];
  const selectedAssignment = assignments.find((item) => item.id === sectionId) || assignments[0];
  const selectedSection = selectedAssignment?.section;
  const selectedSectionId = selectedAssignment?.id || '';
  const roster = useMemo(() => selectedSection ? students.filter((student) => studentMatchesSection(student, selectedSection)) : [], [students, selectedSection]);
  const filteredRoster = useMemo(() => searchStudentsByIdentity(roster, rosterSearch).filter((student) => {
    const individual = Boolean(selectedSection?.includedStudentIds?.includes(student.id));
    return rosterFilter === 'all' || (rosterFilter === 'individual' ? individual : !individual);
  }), [roster, rosterSearch, rosterFilter, selectedSection]);
  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLocaleLowerCase();
    return query ? courses.filter((course) => `${course.courseCode} ${course.courseName}`.toLocaleLowerCase().includes(query)) : courses;
  }, [courses, courseSearch]);
  const candidates = useMemo(() => candidateSearch.trim()
    ? searchStudentsByIdentity(studentDirectory, candidateSearch).slice(0, 30) : [], [studentDirectory, candidateSearch]);
  const sameOffering = (left: Section, right: Section) => left.academicYear === right.academicYear && String(left.semester) === String(right.semester);
  const destinations = selectedSection ? assignments.filter((item) => item.id !== selectedSectionId && sameOffering(item.section, selectedSection)) : [];
  const movingSource = assignments.find((item) => item.id === moveSourceId);
  const movingDestinations = movingSource ? assignments.filter((item) => item.id !== moveSourceId && sameOffering(item.section, movingSource.section)) : [];
  const movingRoster = movingSource ? students.filter((student) => studentMatchesSection(student, movingSource.section)) : [];
  const sectionRoster = (section: Section) => students.filter((student) => studentMatchesSection(student, section));
  const countCourseStudents = (course: Course) => new Set(course.sections.flatMap((section) => sectionRoster(section).map((student) => student.id))).size;
  const totalStudentCount = new Set(courses.flatMap((course) => course.sections.flatMap((section) => sectionRoster(section).map((student) => student.id)))).size;
  const teacherName = (id?: string) => teachers.find((teacher) => teacher.id === id)?.fullName || '—';
  const isPrimary = (section: Section) => (section.primaryTeacherId || section.teacherId) === currentTeacher?.id;
  const existingSectionFor = (student: Student) => selectedCourse && findStudentSectionInCourse(student.id, selectedCourse.id, selectedSectionId);
  const majorCode = (student: Student) => academicState.majors.find((item) => item.id === student.majorId)?.code || student.programCode || '—';
  const groupCode = (student: Student) => academicState.classGroups.find((item) => item.id === student.classGroupId)?.code || 'ยังไม่กำหนด';
  const studentContext = (student: Student) => `${majorCode(student)} • ${student.admissionYear ? `ปีที่เข้าศึกษา ${getAdmissionCode(student.admissionYear)}` : 'ไม่ทราบปีที่เข้าศึกษา'} • ${groupCode(student)}`;
  const groupCodes = [...new Set(roster.map((student) => student.classGroupId).filter((id): id is string => Boolean(id)))].map((id) =>
    academicState.classGroups.find((group) => group.id === id)?.code).filter((code): code is string => Boolean(code));

  const closeModal = () => { setModal(null); setError(''); };
  const openCourse = (course: Course) => {
    setCourseId(course.id);
    setSectionId(course.sections.length ? sectionIdOf(course.id, course.sections[0]) : '');
    setRosterSearch('');
    setRosterFilter('all');
  };
  const openMove = (studentId = '', targetId = '', sourceId = selectedSectionId) => {
    setMoveSourceId(sourceId);
    setMovingStudentId(studentId);
    setDestinationId(targetId);
    setError('');
    setModal('move');
  };
  const addStudent = (studentId: string) => {
    const result = addStudentToSection(studentId, selectedSectionId);
    if (result.success) closeModal(); else setError(result.error || 'ไม่สามารถเพิ่มนักศึกษาได้');
  };
  const moveStudent = () => {
    if (!movingStudentId || !destinationId) { setError('กรุณาเลือกนักศึกษาและ Section ปลายทาง'); return; }
    const result = moveStudentBetweenSections(movingStudentId, moveSourceId, destinationId);
    if (result.success) closeModal(); else setError(result.error || 'ไม่สามารถย้ายนักศึกษาได้');
  };

  return <div className="min-w-0 space-y-5 text-left">
    {!selectedCourse ? <>
      <header className="flex flex-col justify-between gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-start">
        <div><h1 className="flex items-center gap-2 text-xl font-bold text-gray-900"><BookOpen className="h-5 w-5 text-blue-600" />จัดการรายวิชา & กลุ่มเรียน</h1><p className="mt-1 text-xs text-gray-500">ตรวจสอบรายวิชาและตอนเรียนที่ท่านได้รับมอบหมาย เลือกรายวิชาเพื่อจัดการตอนเรียนและบัญชีนักศึกษา</p></div>
        <div className="inline-flex max-w-full items-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"><GraduationCap className="h-4 w-4 shrink-0" /><span className="truncate">อาจารย์ผู้สอน: {currentTeacher?.fullName || '—'}</span></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={BookOpen} label="รายวิชาที่รับผิดชอบ" value={courses.length} suffix="วิชา" color="blue" />
        <SummaryCard icon={Layers3} label="Section ที่ได้รับมอบหมาย" value={courses.reduce((total, course) => total + course.sections.length, 0)} suffix="ตอนเรียน" color="indigo" />
        <SummaryCard icon={Users} label="นักศึกษารวม" value={totalStudentCount} suffix="คน" color="emerald" />
      </div>
      <label className="relative block rounded-2xl border border-gray-200 bg-white p-3 shadow-xs"><span className="sr-only">ค้นหารายวิชา</span><Search className="absolute left-6 top-5 h-4 w-4 text-gray-400" /><input type="search" value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="ค้นหารหัสวิชา หรือชื่อวิชาที่รับผิดชอบ..." className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filteredCourses.map((course) => <article key={course.id} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-2"><span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-xs font-bold text-blue-700">{course.courseCode}</span><span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700">{course.sections.some(isPrimary) ? 'ผู้สอนหลัก' : 'ผู้สอนร่วม'}</span></div>
          <h2 className="mt-3 min-h-10 text-sm font-bold text-gray-900">{course.courseName}</h2>
          <p className="mt-1 text-xs text-gray-500">{[...new Set(course.sections.map((section) => `ภาคเรียนที่ ${section.semester} / ${section.academicYear}`))].join(' • ')}</p>
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-600">Section ที่รับผิดชอบ: <span className="float-right font-bold text-gray-900">{course.sections.length} ตอน</span></p><div className="mt-2 flex flex-wrap gap-1.5">{course.sections.map((section) => <span key={sectionIdOf(course.id, section)} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700">Sec {section.sectionNo}</span>)}</div></div>
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-gray-100 pt-4"><div><p className="text-[11px] text-gray-500">นักศึกษารวม</p><p className="text-sm font-bold text-gray-900">{countCourseStudents(course)} คน</p></div><button type="button" onClick={() => openCourse(course)} className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-400">ดูรายละเอียด <ArrowRight className="h-4 w-4" /></button></div>
        </article>)}
        {!filteredCourses.length && <p className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">{courses.length ? 'ไม่พบรายวิชาที่ตรงกับคำค้นหา' : 'ยังไม่มีรายวิชาที่ได้รับมอบหมาย'}</p>}
      </section>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 text-xs"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setCourseId(''); setSectionId(''); setRosterSearch(''); }} className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 font-semibold text-blue-700 hover:bg-blue-50"><ArrowLeft className="h-4 w-4" />กลับไปรายวิชาของฉัน</button><span className="text-gray-400">/</span><span className="font-semibold text-blue-700">{selectedCourse.courseCode}</span><span className="text-gray-400">/</span><span className="text-gray-600">Section {selectedSection?.sectionNo || '—'}</span></div><span className="text-gray-500">อาจารย์: <strong className="text-gray-800">{currentTeacher?.fullName}</strong></span></div>
      <section className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-blue-600 px-2 py-1 font-mono text-xs font-bold text-white">{selectedCourse.courseCode}</span><span className="text-xs text-gray-500">{[...new Set(assignments.map(({ section }) => `ภาคเรียน ${section.semester} / ${section.academicYear}`))].join(' • ')}</span></div><h1 className="mt-2 text-lg font-bold text-gray-900">{selectedCourse.courseName}</h1><p className="mt-1 text-xs text-gray-500">เลือกตอนเรียน (Section) เพื่อดูบัญชีรายชื่อนักศึกษา หรือทำการเพิ่มและย้ายนักศึกษาข้ามกลุ่ม</p></div>
        <div className="min-w-0 lg:text-right"><p className="text-xs font-semibold text-gray-600">ตอนเรียนที่ได้รับมอบหมาย</p><div className="mt-2 flex flex-wrap gap-2 lg:justify-end">{assignments.map((item) => <button key={item.id} type="button" onClick={() => setSectionId(item.id)} aria-pressed={selectedSectionId === item.id} className={`min-h-9 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus:ring-2 focus:ring-blue-400 ${selectedSectionId === item.id ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'}`}>Sec {item.section.sectionNo} <span className={selectedSectionId === item.id ? 'ml-1 rounded-md bg-white/20 px-1.5 py-0.5' : 'ml-1 rounded-md bg-gray-100 px-1.5 py-0.5'}>{sectionRoster(item.section).length} คน</span></button>)}</div></div>
      </section>

      {selectedSection && <>
        <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2 text-xs"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700">ตอนเรียนที่ {selectedSection.sectionNo}</span><span className="text-gray-500">• อาจารย์ผู้สอนหลัก: <strong className="text-gray-800">{teacherName(selectedSection.primaryTeacherId || selectedSection.teacherId)}</strong></span><span className="text-gray-500">• ผู้สอนร่วม: {selectedSection.coTeacherIds?.length ? selectedSection.coTeacherIds.map(teacherName).join(', ') : 'ไม่มี'}</span></div><div className="flex flex-wrap items-center gap-1.5"><span className="text-gray-600">กลุ่มเรียนที่ครอบคลุม:</span>{groupCodes.map((code) => <span key={code} className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-700">{code}</span>)}{!groupCodes.length && <span className="text-gray-500">ยังไม่มีกลุ่มเรียนที่กำหนด</span>}</div></div>
          <div className="flex shrink-0 gap-2"><div className="min-w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center"><p className="text-[10px] text-gray-500">นักศึกษาใน Section</p><p className="text-lg font-bold text-gray-900">{roster.length}</p></div><div className="min-w-20 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center"><p className="text-[10px] text-gray-500">กลุ่มเรียน</p><p className="text-lg font-bold text-blue-700">{groupCodes.length}</p></div></div>
        </section>
        <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center"><label className="relative min-w-0 flex-1"><span className="sr-only">ค้นหานักศึกษาใน Section {selectedSection.sectionNo}</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input type="search" placeholder={`ค้นหานักศึกษาใน Section ${selectedSection.sectionNo} (รหัส, ชื่อ-สกุล)...`} value={rosterSearch} onChange={(event) => setRosterSearch(event.target.value)} className="min-h-9 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><select aria-label="กรองการลงทะเบียนนักศึกษา" value={rosterFilter} onChange={(event) => setRosterFilter(event.target.value as RosterFilter)} className="min-h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"><option value="all">นักศึกษาทั้งหมด</option><option value="cohort">ตามกลุ่มเรียนปกติ</option><option value="individual">เพิ่มรายบุคคล</option></select><button type="button" onClick={() => { setModal('add'); setCandidateSearch(''); setError(''); }} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"><UserPlus className="h-4 w-4" />เพิ่มนักศึกษา</button></div>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs"><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-xs"><thead className="border-b border-gray-200 bg-gray-50 font-semibold text-gray-600"><tr><th className="px-4 py-3">รหัสนักศึกษา</th><th className="px-4 py-3">ชื่อ-นามสกุล</th><th className="px-4 py-3">สาขาวิชา</th><th className="px-4 py-3">ปีที่เข้าศึกษา / ชั้นปี</th><th className="px-4 py-3">กลุ่มเรียน</th><th className="px-4 py-3">การลงทะเบียน</th><th className="px-4 py-3">สถานะบัญชี</th><th className="px-4 py-3">การจัดการ</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredRoster.map((student) => {
          const level = student.admissionYear ? calculateYearLevelFromAdmissionYear(student.admissionYear) : null;
          const individual = Boolean(selectedSection.includedStudentIds?.includes(student.id));
          return <tr key={student.id} className="hover:bg-gray-50/70"><td className="px-4 py-3 font-mono font-semibold text-gray-900">{student.studentCode}</td><td className="px-4 py-3 font-medium text-gray-900">{student.fullName}</td><td className="px-4 py-3 text-gray-700">{majorCode(student)}</td><td className="px-4 py-3 text-gray-700">{student.admissionYear ? getAdmissionCode(student.admissionYear) : '—'} / {level?.formattedYearLevel || '—'}</td><td className="px-4 py-3"><span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-700">{groupCode(student)}</span></td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[11px] ${individual ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{individual ? 'เพิ่มรายบุคคล' : 'ตามกลุ่มเรียนปกติ'}</span></td><td className="px-4 py-3"><AccountStatusBadge status={student.accountStatus} /></td><td className="px-4 py-3"><button type="button" onClick={() => openMove(student.id)} disabled={!destinations.length} className="min-h-8 rounded-lg px-2 font-semibold text-blue-700 hover:bg-blue-50 focus:ring-2 focus:ring-blue-300 disabled:text-gray-400" aria-label={`ย้าย ${student.fullName} ไปยัง Section อื่น`}>ย้าย</button></td></tr>;
        })}{!filteredRoster.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">ไม่พบนักศึกษาที่ตรงกับตัวกรองใน Section นี้</td></tr>}</tbody></table></div></div>
        {!destinations.length && <p className="text-xs text-gray-500">การย้ายต้องมี Section อื่นในรายวิชาและภาคการศึกษาเดียวกันที่คุณได้รับมอบหมาย</p>}
      </>}
    </>}

    <Modal isOpen={modal === 'add'} onClose={closeModal} title="เพิ่มนักศึกษาเข้า Section" maxWidth="2xl">
      <p className="text-xs text-gray-600">{selectedCourse?.courseCode} • Section {selectedSection?.sectionNo} — เลือกจากนักศึกษาที่มีอยู่ในระบบเท่านั้น</p>
      <input type="search" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="ค้นหารหัสนักศึกษา ชื่อ หรืออีเมล..." className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{candidates.map((student) => {
        const alreadyHere = Boolean(selectedSection && studentMatchesSection(student, selectedSection));
        const other = existingSectionFor(student);
        const level = student.admissionYear ? calculateYearLevelFromAdmissionYear(student.admissionYear) : null;
        return <div key={student.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-gray-900">{student.studentCode} • {student.fullName}</p><p className="mt-1 text-[11px] text-gray-500">{studentContext(student)} • {level?.formattedYearLevel || '—'}</p><p className="mt-1 text-[11px] text-gray-500">{alreadyHere ? 'อยู่ใน Section นี้แล้ว' : other ? `ปัจจุบันอยู่ใน Section ${other.sectionNo}` : `ยังไม่ได้อยู่ใน ${selectedCourse?.courseCode}`}</p></div>{alreadyHere ? <button type="button" disabled className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">อยู่ใน Section นี้แล้ว</button> : other ? other.manageable ? <button type="button" onClick={() => openMove(student.id, selectedSectionId, other.sectionId)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800">ย้ายมายัง Section {selectedSection?.sectionNo}</button> : <span className="text-[11px] text-amber-700">ต้องได้รับมอบหมาย Section {other.sectionNo} ก่อนจึงจะย้ายได้</span> : <button type="button" onClick={() => addStudent(student.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">เพิ่มนักศึกษา</button>}</div>;
      })}{candidateSearch.trim() && !candidates.length && <p className="py-8 text-center text-sm text-gray-500">ไม่พบนักศึกษาในระบบ</p>}{!candidateSearch.trim() && <p className="py-8 text-center text-xs text-gray-500">พิมพ์รหัสนักศึกษา ชื่อ หรืออีเมลเพื่อค้นหา</p>}</div>
    </Modal>
    <Modal isOpen={modal === 'move'} onClose={closeModal} title="ย้ายนักศึกษา" maxWidth="md" footer={<><button type="button" onClick={closeModal} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700">ยกเลิก</button><button type="button" onClick={moveStudent} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">ยืนยันการย้าย</button></>}>
      <div className="space-y-3 text-xs"><label className="block font-semibold text-gray-700">นักศึกษา<select value={movingStudentId} onChange={(event) => setMovingStudentId(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"><option value="">เลือกนักศึกษา</option>{movingRoster.map((student) => <option key={student.id} value={student.id}>{student.studentCode} • {student.fullName}</option>)}</select></label><p className="text-gray-600">จาก: {selectedCourse?.courseCode} • Section {movingSource?.section.sectionNo}</p><label className="block font-semibold text-gray-700">ไปยัง<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"><option value="">เลือก Section ปลายทาง</option>{movingDestinations.map((item) => <option key={item.id} value={item.id}>Section {item.section.sectionNo} • ภาคเรียน {item.section.semester} / {item.section.academicYear}</option>)}</select></label>{error && <p role="alert" className="font-semibold text-red-600">{error}</p>}</div>
    </Modal>
  </div>;
};

interface SummaryCardProps { icon: React.ComponentType<{ className?: string }>; label: string; value: number; suffix: string; color: 'blue' | 'indigo' | 'emerald' }
const SummaryCard: React.FC<SummaryCardProps> = ({ icon: Icon, label, value, suffix, color }) => {
  const tone = { blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600' }[color];
  return <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs"><div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div><div><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-gray-900">{value} <span className="text-xs font-medium text-gray-500">{suffix}</span></p></div></div>;
};
