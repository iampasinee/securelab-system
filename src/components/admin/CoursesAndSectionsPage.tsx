import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUpDown, BookOpen, BookPlus, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Eye,
  Filter, GraduationCap, Pencil, Plus, Search, Trash2, Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Course, Section, SectionCohort } from '../../types';
import { CourseInput, CourseSemester, SectionInput } from '../../types/course';
import { AcademicState } from '../../types/academic';
import {
  cohortKey, courseDeleteError, courseOfferingSettings, courseStudentCount, findSection, sectionDeleteError,
  sectionIdOf, sectionStudentCount,
} from '../../services/courseState';
import { academicSettings, getAdmissionCode } from '../../utils/academicYear';
import { isAcademicPathActive } from '../../services/academicState';
import { Modal } from '../common/Modal';

type Tab = 'courses' | 'sections';
type Sort = { key: string; asc: boolean };
const pageSize = 10;
const buttonClass = 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40';
const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-blue-600 disabled:bg-slate-100 disabled:text-slate-400';
const statusBadge = (status?: string) => <span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] ${status !== 'inactive' ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{status !== 'inactive' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>;
const semesterLabel = (semester: Section['semester']) => String(semester) === 'summer' ? 'ภาคฤดูร้อน' : `ภาคที่ ${semester}`;
const formatCohortLabel = (cohort: SectionCohort, academicState: AcademicState) => {
  const majorCode = academicState.majors.find((major) => major.id === cohort.majorId)?.code || '—';
  const groupCodes = (cohort.classGroupIds || []).map((groupId) => academicState.classGroups.find((group) => group.id === groupId)?.code).filter(Boolean);
  return `${majorCode} ปีที่เข้าศึกษา ${getAdmissionCode(cohort.admissionYear)}${groupCodes.length ? ` · ${groupCodes.join(' + ')}` : ' · ทั้งหมด'}`;
};

const emptyCourseForm = (facultyId = ''): CourseInput => ({ code: '', name: '', facultyId, departmentId: '', status: 'active' });
const emptySectionForm = (courseId = ''): SectionInput => ({
  courseId, sectionNumber: 1, semester: courseOfferingSettings.currentSemester,
  academicYear: academicSettings.currentAcademicYear, primaryTeacherId: '', coTeacherIds: [], cohorts: [], status: 'active',
});

export const CoursesAndSectionsPage: React.FC = () => {
  const {
    courses, academicState, teachers, students, examSessions, saveCourseRecord, saveSectionRecord,
    deleteCourse, deleteSectionRecord, setSectionStatus,
  } = useApp();
  const [tab, setTab] = useState<Tab>('courses');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'code', asc: true });
  const [page, setPage] = useState(1);
  const [courseEditor, setCourseEditor] = useState<Course | 'new' | null>(null);
  const [courseForm, setCourseForm] = useState<CourseInput>(() => emptyCourseForm());
  const [sectionEditor, setSectionEditor] = useState<{ course: Course; section?: Section } | 'new' | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionInput>(() => emptySectionForm());
  const [sectionFacultyId, setSectionFacultyId] = useState('');
  const [sectionDepartmentId, setSectionDepartmentId] = useState('');
  const [detail, setDetail] = useState<{ type: Tab; course: Course; section?: Section } | null>(null);
  const [confirm, setConfirm] = useState<{ type: Tab; action: 'delete' | 'status'; course: Course; section?: Section } | null>(null);
  const [error, setError] = useState('');

  const allSections = useMemo(() => courses.flatMap((course) => course.sections.map((section) => ({ course, section, id: sectionIdOf(course.id, section) }))), [courses]);
  const activeSections = allSections.filter(({ section }) => section.status !== 'inactive');
  const currentSections = activeSections.filter(({ section }) => section.academicYear === academicSettings.currentAcademicYear && String(section.semester) === String(courseOfferingSettings.currentSemester));
  const assignedTeachers = new Set(activeSections.flatMap(({ section }) => [section.primaryTeacherId || section.teacherId, ...(section.coTeacherIds || [])]).filter(Boolean));
  const enrolledCohorts = new Set(activeSections.flatMap(({ section }) => (section.cohorts || []).map(cohortKey)));
  const metrics = [
    { label: 'รายวิชาทั้งหมด', value: courses.length, unit: 'วิชา', icon: BookOpen, color: 'text-blue-600', iconBg: 'bg-blue-50' },
    { label: 'รายวิชาที่เปิดใช้งาน', value: courses.filter((course) => course.status === 'active').length, unit: 'วิชา', icon: CheckCircle2, color: 'text-teal-600', iconBg: 'bg-teal-50' },
    { label: 'ตอนเรียนภาคปัจจุบัน', value: currentSections.length, unit: `ตอนเรียน (${courseOfferingSettings.currentSemester}/${academicSettings.currentAcademicYear})`, icon: CalendarDays, color: 'text-indigo-600', iconBg: 'bg-indigo-50' },
    { label: 'อาจารย์ผู้สอน', value: assignedTeachers.size, unit: 'ท่าน', icon: GraduationCap, color: 'text-amber-600', iconBg: 'bg-amber-50' },
    { label: 'กลุ่มรหัสที่ลงทะเบียน', value: enrolledCohorts.size, unit: 'รายการ', icon: Users, color: 'text-violet-600', iconBg: 'bg-violet-50' },
    { label: 'ยังไม่มีอาจารย์', value: allSections.filter(({ section }) => !(section.primaryTeacherId || section.teacherId)).length, unit: 'ตอนเรียน', icon: AlertTriangle, color: 'text-red-600', iconBg: 'bg-red-100', warning: true },
  ];
  const departments = academicState.departments.filter((department) => !facultyFilter || department.facultyId === facultyFilter);
  const activeTeachers = teachers.filter((teacher) => teacher.accountStatus === 'active');
  const sectionYears = [...new Set<number>(allSections.map(({ section }) => Number(section.academicYear)))].sort((a, b) => b - a);

  const courseRows = useMemo(() => courses.filter((course) => {
    const term = search.trim().toLowerCase();
    return (!term || `${course.courseCode} ${course.courseName}`.toLowerCase().includes(term)) &&
      (!statusFilter || course.status === statusFilter) && (!facultyFilter || course.facultyId === facultyFilter) &&
      (!departmentFilter || course.departmentId === departmentFilter);
  }).sort((left, right) => {
    const values = (course: Course) => sort.key === 'name' ? course.courseName : sort.key === 'updated' ? course.updatedAt || '' : course.courseCode;
    const result = values(left).localeCompare(values(right), 'th', { numeric: true, sensitivity: 'base' });
    return sort.asc ? result : -result;
  }), [courses, search, statusFilter, facultyFilter, departmentFilter, sort]);

  const sectionRows = useMemo(() => allSections.filter(({ course, section }) => {
    const term = search.trim().toLowerCase();
    const teacherIds = [section.primaryTeacherId || section.teacherId, ...(section.coTeacherIds || [])];
    return (!term || `${course.courseCode} ${course.courseName}`.toLowerCase().includes(term)) &&
      (!statusFilter || (section.status || 'active') === statusFilter) && (!semesterFilter || String(section.semester) === semesterFilter) &&
      (!yearFilter || section.academicYear === Number(yearFilter)) && (!facultyFilter || course.facultyId === facultyFilter) &&
      (!departmentFilter || course.departmentId === departmentFilter) && (!courseFilter || course.id === courseFilter) &&
      (!teacherFilter || teacherIds.includes(teacherFilter));
  }).sort((left, right) => {
    const value = ({ course, section }: typeof left) => sort.key === 'section' ? Number(section.sectionNumber || section.sectionNo)
      : sort.key === 'year' ? section.academicYear : course.courseCode;
    const result = String(value(left)).localeCompare(String(value(right)), 'th', { numeric: true, sensitivity: 'base' });
    return sort.asc ? result : -result;
  }), [allSections, search, statusFilter, semesterFilter, yearFilter, facultyFilter, departmentFilter, courseFilter, teacherFilter, sort]);
  const rows = tab === 'courses' ? courseRows : sectionRows;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [tab, search, statusFilter, semesterFilter, yearFilter, facultyFilter, departmentFilter, courseFilter, teacherFilter, sort]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);

  const toggleSort = (key: string) => setSort((current) => ({ key, asc: current.key === key ? !current.asc : true }));
  const selectTab = (nextTab: Tab) => {
    setTab(nextTab); setSearch(''); setStatusFilter(''); setSemesterFilter(''); setYearFilter('');
    setFacultyFilter(''); setDepartmentFilter(''); setCourseFilter(''); setTeacherFilter('');
    setSort({ key: 'code', asc: true }); setPage(1);
  };
  const SortHeader: React.FC<{ value: string; label: string }> = ({ value, label }) => <button type="button" onClick={() => toggleSort(value)} className="inline-flex items-center gap-1 text-left">{label}<ArrowUpDown className="h-3 w-3" /></button>;
  const openCourse = (course?: Course) => {
    const facultyId = course?.facultyId || academicState.faculties.find((item) => item.status === 'active')?.id || '';
    const departmentId = course?.departmentId || academicState.departments.find((item) =>
      item.facultyId === facultyId && isAcademicPathActive(academicState, 'departments', item.id))?.id || '';
    setCourseForm(course ? { code: course.courseCode, name: course.courseName, facultyId, departmentId, status: course.status } : { ...emptyCourseForm(facultyId), departmentId });
    setCourseEditor(course || 'new'); setError('');
  };
  const openSection = (located?: { course: Course; section?: Section }, preferredCourseId?: string) => {
    const course = located?.course || courses.find((item) => item.id === preferredCourseId) || courses.find((item) => item.status === 'active');
    const section = located?.section;
    const nextSectionNumber = course ? Math.max(0, ...course.sections.map((item) => Number(item.sectionNumber || item.sectionNo))) + 1 : 1;
    setSectionForm(section && course ? {
      courseId: course.id, sectionNumber: Number(section.sectionNumber || section.sectionNo), semester: section.semester as CourseSemester,
      academicYear: section.academicYear, primaryTeacherId: section.primaryTeacherId || section.teacherId,
      coTeacherIds: section.coTeacherIds || [], cohorts: section.cohorts || [], status: section.status || 'active',
    } : { ...emptySectionForm(course?.id || ''), sectionNumber: nextSectionNumber });
    setSectionFacultyId(course?.facultyId || academicState.faculties.find((item) => item.status === 'active')?.id || '');
    setSectionDepartmentId(course?.departmentId || '');
    setSectionEditor(section && course ? { course, section } : 'new'); setError('');
  };
  const editorCourseId = sectionEditor !== 'new' && sectionEditor ? sectionEditor.course.id : undefined;
  const editorSectionId = sectionEditor !== 'new' && sectionEditor?.section ? sectionIdOf(sectionEditor.course.id, sectionEditor.section) : undefined;
  const selectedCohortStudentCount = courseStudentCount(students, sectionForm.cohorts);
  const cohortLabel = (cohort: SectionCohort) => formatCohortLabel(cohort, academicState);
  const setWholeCohort = (majorId: string, admissionYear: number, checked: boolean) => {
    const others = sectionForm.cohorts.filter((cohort) => cohort.majorId !== majorId || cohort.admissionYear !== admissionYear);
    setSectionForm({ ...sectionForm, cohorts: checked ? [...others, { majorId, admissionYear }] : others });
  };
  const setClassGroupCohort = (majorId: string, admissionYear: number, classGroupId: string, checked: boolean) => {
    const current = sectionForm.cohorts.find((cohort) => cohort.majorId === majorId && cohort.admissionYear === admissionYear);
    const nextIds = checked
      ? [...new Set([...(current?.classGroupIds || []), classGroupId])]
      : (current?.classGroupIds || []).filter((id) => id !== classGroupId);
    const others = sectionForm.cohorts.filter((cohort) => cohort.majorId !== majorId || cohort.admissionYear !== admissionYear);
    setSectionForm({ ...sectionForm, cohorts: nextIds.length ? [...others, { majorId, admissionYear, classGroupIds: nextIds }] : others });
  };
  const actionIcon = (title: string, Icon: React.ElementType, action: () => void, disabled = false) => <button type="button" title={title} aria-label={title} disabled={disabled} onClick={action} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-30"><Icon className="h-4 w-4" /></button>;

  return <div className="min-w-0 space-y-5 text-left">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><BookOpen className="h-4 w-4" /></span><h1 className="text-xl font-bold text-slate-950">จัดการรายวิชาและตอนเรียน</h1></div><p className="mt-1 text-xs text-slate-500">เพิ่มและจัดการข้อมูลรายวิชา ตอนเรียน ภาคการศึกษา ปีการศึกษา สาขาวิชา รหัส และอาจารย์ผู้สอน</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => openCourse()} className={`${buttonClass} border border-blue-200 bg-white text-blue-700`}><Plus className="h-4 w-4" />เพิ่มรายวิชา</button><button onClick={() => openSection()} disabled={!courses.some((course) => course.status === 'active')} className={`${buttonClass} bg-blue-600 text-white`}><BookPlus className="h-4 w-4" />เปิดตอนเรียนใหม่</button></div>
    </header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{metrics.map(({ label, value, unit, icon: Icon, color, iconBg, warning }) => <article key={label} className={`rounded-2xl border p-4 shadow-sm ${warning && value > 0 ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between gap-2 text-[11px] text-slate-500"><span className={warning && value > 0 ? 'font-semibold text-red-700' : ''}>{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg} ${color}`}><Icon className="h-4 w-4" /></span></div><div className="mt-2 flex items-baseline gap-1.5"><strong className={`text-2xl ${warning && value === 0 ? 'text-slate-900' : color}`}>{value}</strong><span className="text-[10px] text-slate-400">{unit}</span></div></article>)}</div>
    <div role="tablist" className="flex border-b border-slate-200"><button role="tab" aria-selected={tab === 'courses'} onClick={() => selectTab('courses')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${tab === 'courses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><BookOpen className="h-4 w-4" />รายวิชา (Courses)<span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px]">{courses.length}</span></button><button role="tab" aria-selected={tab === 'sections'} onClick={() => selectTab('sections')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${tab === 'sections' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><CalendarDays className="h-4 w-4" />ตอนเรียน (Sections)<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{allSections.length}</span></button></div>
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="relative min-w-56 flex-1"><span className="sr-only">ค้นหา</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-9`} placeholder="ค้นหาด้วยรหัสวิชา หรือชื่อวิชา..." /></label><button type="button" onClick={() => tab === 'courses' ? openCourse() : openSection()} className={`${buttonClass} shrink-0 bg-blue-600 text-white`}><Plus className="h-4 w-4" />{tab === 'courses' ? 'เพิ่มรายวิชา' : 'เปิดตอนเรียนใหม่'}</button></div>
      <div className="flex flex-wrap items-center gap-2.5"><span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><Filter className="h-4 w-4" />กรองข้อมูล:</span>
        {tab === 'sections' && <><select aria-label="ภาคการศึกษา" value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)} className={`${inputClass} sm:w-auto sm:min-w-36`}><option value="">ทุกภาคการศึกษา</option><option value="1">ภาคที่ 1</option><option value="2">ภาคที่ 2</option><option value="summer">ภาคฤดูร้อน</option></select><select aria-label="ปีการศึกษา" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className={`${inputClass} sm:w-auto sm:min-w-32`}><option value="">ทุกปีการศึกษา</option>{sectionYears.map((year) => <option key={year}>{year}</option>)}</select></>}
        <select aria-label="คณะ" value={facultyFilter} onChange={(event) => { setFacultyFilter(event.target.value); setDepartmentFilter(''); setCourseFilter(''); }} className={`${inputClass} sm:w-auto sm:min-w-56`}><option value="">คณะทั้งหมด</option>{academicState.faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select>
        <select aria-label="ภาควิชา" disabled={!facultyFilter} value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setCourseFilter(''); }} className={`${inputClass} sm:w-auto sm:min-w-44`}><option value="">ภาควิชาทั้งหมด</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
        {tab === 'sections' && <><select aria-label="รายวิชา" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className={`${inputClass} sm:w-auto sm:min-w-44`}><option value="">ทุกรายวิชา</option>{courses.filter((course) => (!facultyFilter || course.facultyId === facultyFilter) && (!departmentFilter || course.departmentId === departmentFilter)).map((course) => <option key={course.id} value={course.id}>{course.courseCode} — {course.courseName}</option>)}</select><select aria-label="อาจารย์ผู้สอน" value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} className={`${inputClass} sm:w-auto sm:min-w-40`}><option value="">อาจารย์ทุกคน</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></>}
        <select aria-label="สถานะ" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`${inputClass} sm:w-auto sm:min-w-32`}><option value="">สถานะทั้งหมด</option><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select>
        <span className="ml-auto text-xs text-slate-400">พบ {rows.length} {tab === 'courses' ? 'รายวิชา' : 'ตอนเรียน'}</span>
      </div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-slate-50 text-slate-600">{tab === 'courses' ? <tr><th className="px-4 py-3"><SortHeader value="code" label="รหัสวิชา" /></th><th className="px-4 py-3"><SortHeader value="name" label="ชื่อวิชา" /></th><th className="px-4 py-3">คณะที่รับผิดชอบ</th><th className="px-4 py-3">ภาควิชาที่รับผิดชอบ</th><th className="px-4 py-3 text-center">ตอนเรียน</th><th className="px-4 py-3 text-center">อาจารย์</th><th className="px-4 py-3 text-center">สถานะ</th><th className="px-4 py-3 text-right">การจัดการ</th></tr> : <tr><th className="px-4 py-3"><SortHeader value="code" label="รหัสวิชา" /></th><th className="px-4 py-3">ชื่อวิชา</th><th className="px-4 py-3"><SortHeader value="section" label="ตอนเรียน" /></th><th className="px-4 py-3"><SortHeader value="year" label="ภาค/ปี" /></th><th className="px-4 py-3">อาจารย์ผู้สอน</th><th className="px-4 py-3">สาขาวิชา / รหัส</th><th className="px-4 py-3 text-center">นักศึกษา</th><th className="px-4 py-3 text-center">สถานะ</th><th className="px-4 py-3 text-right">การจัดการ</th></tr>}</thead>
        <tbody className="divide-y divide-slate-100">{tab === 'courses' ? (visible as Course[]).map((course) => {
          const teacherIds = new Set(course.sections.flatMap((section) => [section.primaryTeacherId || section.teacherId, ...(section.coTeacherIds || [])]).filter(Boolean));
          const activeSectionCount = course.sections.filter((section) => section.status !== 'inactive').length;
          return <tr key={course.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-mono font-bold text-blue-700">{course.courseCode}</td><td className="px-4 py-4 font-semibold">{course.courseName}</td><td className="max-w-48 truncate px-4 py-4">{course.faculty}</td><td className="max-w-44 truncate px-4 py-4">{course.department}</td><td className="px-4 py-4 text-center"><span className="font-semibold">{course.sections.length}</span>{activeSectionCount > 0 && <span className="ml-1 text-[10px] text-emerald-600">({activeSectionCount} เปิดสอน)</span>}</td><td className="px-4 py-4 text-center">{teacherIds.size} ท่าน</td><td className="px-4 py-4 text-center"><button type="button" aria-label={`${course.status === 'active' ? 'ปิด' : 'เปิด'}ใช้งานรายวิชา ${course.courseCode}`} title="คลิกเพื่อเปลี่ยนสถานะ" onClick={() => setConfirm({ type: 'courses', action: 'status', course })} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{statusBadge(course.status)}</button></td><td className="px-3 py-3"><div className="flex justify-end">{actionIcon('ดูรายละเอียด', Eye, () => setDetail({ type: 'courses', course }))}{actionIcon('แก้ไข', Pencil, () => openCourse(course))}{actionIcon('เปิดตอนเรียน', Plus, () => openSection(undefined, course.id), course.status !== 'active')}{actionIcon('ลบ', Trash2, () => setConfirm({ type: 'courses', action: 'delete', course }))}</div></td></tr>;
        }) : (visible as typeof sectionRows).map(({ course, section, id }) => {
          const primary = teachers.find((teacher) => teacher.id === (section.primaryTeacherId || section.teacherId));
          const co = (section.coTeacherIds || []).map((teacherId) => teachers.find((teacher) => teacher.id === teacherId)?.fullName).filter(Boolean);
          return <tr key={id} className="hover:bg-slate-50"><td className="px-4 py-4 font-mono font-bold text-blue-700">{course.courseCode}</td><td className="px-4 py-4">{course.courseName}</td><td className="px-4 py-4 font-semibold">ตอนเรียนที่ {section.sectionNo}</td><td className="px-4 py-4">{semesterLabel(section.semester)} / {section.academicYear}</td><td className="px-4 py-4"><strong>{primary?.fullName || 'ยังไม่มีอาจารย์'}</strong>{co.length > 0 && <div className="text-[10px] text-slate-500">ร่วม: {co.join(', ')}</div>}</td><td className="px-4 py-4"><div className="flex max-w-64 flex-wrap gap-1">{(section.cohorts || []).map((cohort) => <span key={cohortKey(cohort)} className="rounded-md bg-blue-50 px-2 py-1 text-[10px] text-blue-700">{cohortLabel(cohort)}</span>)}</div></td><td className="px-4 py-4 text-center font-semibold">{sectionStudentCount(students, section)}</td><td className="px-4 py-4 text-center"><button type="button" aria-label={`${section.status === 'inactive' ? 'เปิด' : 'ปิด'}ใช้งานตอนเรียน ${section.sectionNo}`} title="คลิกเพื่อเปลี่ยนสถานะ" onClick={() => setConfirm({ type: 'sections', action: 'status', course, section })} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{statusBadge(section.status)}</button></td><td className="px-3 py-3"><div className="flex justify-end">{actionIcon('ดูรายละเอียด', Eye, () => setDetail({ type: 'sections', course, section }))}{actionIcon('แก้ไข', Pencil, () => openSection({ course, section }))}{actionIcon('จัดการอาจารย์', GraduationCap, () => openSection({ course, section }))}{actionIcon('จัดการสาขาวิชา รหัส และกลุ่มเรียน', Users, () => openSection({ course, section }))}{actionIcon('ลบ', Trash2, () => setConfirm({ type: 'sections', action: 'delete', course, section }))}</div></td></tr>;
        })}{!visible.length && <tr><td colSpan={tab === 'courses' ? 8 : 9} className="px-4 py-14 text-center text-slate-400">{tab === 'courses' ? 'ไม่พบรายวิชาที่ตรงกับเงื่อนไข' : 'ไม่พบตอนเรียนที่ตรงกับเงื่อนไข'}</td></tr>}</tbody></table></div>
      <footer className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-xs text-slate-500"><span>แสดง {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)} จาก {rows.length} รายการ</span><div className="flex items-center gap-2"><button aria-label="หน้าก่อนหน้า" disabled={page === 1} onClick={() => setPage(page - 1)} className={buttonClass}><ChevronLeft className="h-4 w-4" /></button><span>{page} / {pages}</span><button aria-label="หน้าถัดไป" disabled={page === pages} onClick={() => setPage(page + 1)} className={buttonClass}><ChevronRight className="h-4 w-4" /></button></div></footer>
    </section>

    <Modal isOpen={Boolean(courseEditor)} onClose={() => setCourseEditor(null)} title={courseEditor === 'new' ? 'เพิ่มรายวิชาใหม่' : 'แก้ไขรายวิชา'} maxWidth="wide"><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const result = saveCourseRecord(courseForm, courseEditor === 'new' ? undefined : courseEditor?.id); if (result.success) setCourseEditor(null); else setError(result.error || ''); }}>
      <label className="block text-xs font-semibold text-slate-700">รหัสวิชา (Course Code) <span className="text-red-500">*</span><input autoFocus value={courseForm.code} maxLength={20} placeholder="เช่น CS301, CPE101, INET321" onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} className={`${inputClass} mt-1`} /><span className="mt-1 block text-[10px] font-normal text-slate-400">ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ ตัวเลข หรือเครื่องหมายขีด (สูงสุด 20 ตัวอักษร)</span></label>
      <label className="block text-xs font-semibold text-slate-700">ชื่อวิชา (Course Title) <span className="text-red-500">*</span><input value={courseForm.name} maxLength={200} placeholder="เช่น โครงสร้างข้อมูลและขั้นตอนวิธี" onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} className={`${inputClass} mt-1`} /></label>
      <label className="block text-xs font-semibold text-slate-700">คณะที่รับผิดชอบ <span className="text-red-500">*</span><select value={courseForm.facultyId} onChange={(event) => setCourseForm({ ...courseForm, facultyId: event.target.value, departmentId: '' })} className={`${inputClass} mt-1`}><option value="">เลือกคณะ</option>{academicState.faculties.filter((faculty) => faculty.status === 'active' || faculty.id === courseForm.facultyId).map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label>
      <label className="block text-xs font-semibold text-slate-700">ภาควิชาที่รับผิดชอบ <span className="text-red-500">*</span><select value={courseForm.departmentId} disabled={!courseForm.facultyId} onChange={(event) => setCourseForm({ ...courseForm, departmentId: event.target.value })} className={`${inputClass} mt-1`}><option value="">เลือกภาควิชา</option>{academicState.departments.filter((department) => department.facultyId === courseForm.facultyId && (isAcademicPathActive(academicState, 'departments', department.id) || department.id === courseForm.departmentId)).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <fieldset><legend className="mb-1 text-xs font-semibold text-slate-700">สถานะรายวิชา</legend><div className="flex flex-wrap gap-5 text-xs"><label className="flex items-center gap-2 text-teal-700"><input type="radio" name="course-status" checked={courseForm.status === 'active'} onChange={() => setCourseForm({ ...courseForm, status: 'active' })} />เปิดใช้งาน (Active)</label><label className="flex items-center gap-2 text-slate-500"><input type="radio" name="course-status" checked={courseForm.status === 'inactive'} onChange={() => setCourseForm({ ...courseForm, status: 'inactive' })} />ปิดใช้งาน (Inactive)</label></div></fieldset>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t pt-3"><button type="button" onClick={() => setCourseEditor(null)} className={`${buttonClass} bg-slate-100 text-slate-600`}>ยกเลิก</button><button className={`${buttonClass} bg-blue-600 text-white`}><Check className="h-4 w-4" />บันทึกรายวิชา</button></div>
    </form></Modal>

    <Modal isOpen={Boolean(sectionEditor)} onClose={() => setSectionEditor(null)} title={sectionEditor === 'new' ? 'เปิดตอนเรียนใหม่ (New Section)' : 'แก้ไขตอนเรียน'} maxWidth="wide"><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const result = saveSectionRecord(sectionForm, editorSectionId); if (result.success) setSectionEditor(null); else setError(result.error || ''); }}>
      <label className="block text-xs font-semibold text-slate-700">รายวิชา (Course) <span className="text-red-500">*</span><select value={sectionForm.courseId} onChange={(event) => { const course = courses.find((item) => item.id === event.target.value); setSectionFacultyId(course?.facultyId || ''); setSectionDepartmentId(course?.departmentId || ''); setSectionForm({ ...sectionForm, courseId: event.target.value, cohorts: [] }); }} className={`${inputClass} mt-1`}><option value="">เลือกรายวิชา</option>{courses.filter((course) => course.status === 'active' || course.id === editorCourseId).map((course) => <option key={course.id} value={course.id}>{course.courseCode} - {course.courseName}</option>)}</select></label>
      <div className="grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-slate-700">ปีการศึกษา <span className="text-red-500">*</span><select value={sectionForm.academicYear} onChange={(event) => setSectionForm({ ...sectionForm, academicYear: Number(event.target.value) })} className={`${inputClass} mt-1`}>{Array.from({ length: 4 }, (_, index) => academicSettings.currentAcademicYear - index).map((year) => <option key={year}>{year}</option>)}</select></label><label className="text-xs font-semibold text-slate-700">ภาคการศึกษา <span className="text-red-500">*</span><select value={sectionForm.semester} onChange={(event) => setSectionForm({ ...sectionForm, semester: (event.target.value === 'summer' ? 'summer' : Number(event.target.value)) as CourseSemester })} className={`${inputClass} mt-1`}><option value="1">ภาคการศึกษาที่ 1</option><option value="2">ภาคการศึกษาที่ 2</option><option value="summer">ภาคฤดูร้อน</option></select></label><label className="text-xs font-semibold text-slate-700">หมายเลขตอนเรียน <span className="text-red-500">*</span><input type="number" min="1" step="1" value={sectionForm.sectionNumber} onChange={(event) => setSectionForm({ ...sectionForm, sectionNumber: Number(event.target.value) })} className={`${inputClass} mt-1`} /></label></div>
      <label className="block text-xs font-semibold text-slate-700">อาจารย์ผู้สอนหลัก (Primary Instructor) <span className="text-red-500">*</span><select value={sectionForm.primaryTeacherId} onChange={(event) => setSectionForm({ ...sectionForm, primaryTeacherId: event.target.value, coTeacherIds: sectionForm.coTeacherIds.filter((id) => id !== event.target.value) })} className={`${inputClass} mt-1`}><option value="">เลือกอาจารย์ผู้สอนหลัก</option>{activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName} — {teacher.email} — {teacher.department}</option>)}</select></label>
      <fieldset><legend className="mb-1 text-xs font-semibold text-slate-700">อาจารย์ผู้สอนร่วม (Co-Instructors)</legend><div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">{activeTeachers.filter((teacher) => teacher.id !== sectionForm.primaryTeacherId).map((teacher) => <label key={teacher.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 text-xs ${sectionForm.coTeacherIds.includes(teacher.id) ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-transparent text-slate-700 hover:bg-white'}`}><span className="flex items-center gap-2"><input type="checkbox" checked={sectionForm.coTeacherIds.includes(teacher.id)} onChange={(event) => setSectionForm({ ...sectionForm, coTeacherIds: event.target.checked ? [...sectionForm.coTeacherIds, teacher.id] : sectionForm.coTeacherIds.filter((id) => id !== teacher.id) })} />{teacher.fullName}</span><span className="text-[10px] text-slate-400">{teacher.department}</span></label>)}</div><p className="mt-1 text-[10px] text-slate-400">สามารถเลือกอาจารย์เพิ่มเติมเพื่อร่วมตรวจข้อสอบและดูแลตอนเรียน</p></fieldset>
      <fieldset>
        <div className="mb-1 flex items-center justify-between gap-3"><legend className="text-xs font-semibold text-slate-700">สาขาวิชา ปีที่เข้าศึกษา และกลุ่มเรียน <span className="text-red-500">*</span></legend><span className="text-[10px] font-semibold text-blue-600">รวมนักศึกษาประมาณ {selectedCohortStudentCount} คน ({sectionForm.cohorts.length} รายการ)</span></div>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50">{academicState.majors.filter((major) => major.departmentId === sectionDepartmentId && isAcademicPathActive(academicState, 'majors', major.id)).flatMap((major) => {
          const studentYears = students.filter((student) => student.majorId === major.id && student.admissionYear).map((student) => student.admissionYear!);
          const groupYears = academicState.classGroups.filter((group) => group.majorId === major.id).map((group) => group.admissionYear);
          const years = [...new Set([...studentYears, ...groupYears, academicSettings.currentAcademicYear, academicSettings.currentAcademicYear - 1, academicSettings.currentAcademicYear - 2, academicSettings.currentAcademicYear - 3])].sort((a, b) => b - a);
          return years.map((admissionYear) => {
            const key = cohortKey({ majorId: major.id, admissionYear });
            const selected = sectionForm.cohorts.find((item) => cohortKey(item) === key);
            const wholeSelected = Boolean(selected && !selected.classGroupIds?.length);
            const groups = academicState.classGroups.filter((group) => group.majorId === major.id && group.admissionYear === admissionYear && (group.status === 'active' || selected?.classGroupIds?.includes(group.id)));
            const count = students.filter((student) => student.accountStatus === 'active' && student.majorId === major.id && student.admissionYear === admissionYear).length;
            return <div key={key} className="space-y-2 border-b border-slate-100 px-5 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 text-xs"><strong>{major.code}</strong><span className="text-slate-500">ปีที่เข้าศึกษา {getAdmissionCode(admissionYear)} · ปีการศึกษา {admissionYear}</span><span className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">{count} คน</span></div>
              <div className="flex flex-wrap gap-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${wholeSelected ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600'}`}><input type="checkbox" checked={wholeSelected} onChange={(event) => setWholeCohort(major.id, admissionYear, event.target.checked)} />ทั้งหมดในปีที่เข้าศึกษา</label>
                {groups.map((group) => {
                  const groupSelected = Boolean(selected?.classGroupIds?.includes(group.id));
                  return <label key={group.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${groupSelected ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600'} ${wholeSelected ? 'cursor-not-allowed opacity-50' : ''}`}><input type="checkbox" disabled={wholeSelected} checked={groupSelected} onChange={(event) => setClassGroupCohort(major.id, admissionYear, group.id, event.target.checked)} />{group.code}</label>;
                })}
                {!groups.length && <span className="px-2 py-2 text-[10px] text-slate-400">ยังไม่มีกลุ่มเรียน สามารถเลือกทั้งปีที่เข้าศึกษาได้</span>}
              </div>
            </div>;
          });
        })}</div>
        <p className="mt-1 text-[10px] text-slate-400">เลือกทั้งปีที่เข้าศึกษา หรือเลือก RA / RB ได้หลายกลุ่ม ระบบป้องกันสมาชิกกลุ่มเดียวกันซ้ำในตอนเรียนที่ขัดแย้งกัน</p>
      </fieldset>
      <fieldset><legend className="mb-1 text-xs font-semibold text-slate-700">สถานะตอนเรียน</legend><div className="flex flex-wrap gap-5 text-xs"><label className="flex items-center gap-2 text-teal-700"><input type="radio" name="section-status" checked={sectionForm.status === 'active'} onChange={() => setSectionForm({ ...sectionForm, status: 'active' })} />เปิดใช้งาน (Active)</label><label className="flex items-center gap-2 text-slate-500"><input type="radio" name="section-status" checked={sectionForm.status === 'inactive'} onChange={() => setSectionForm({ ...sectionForm, status: 'inactive' })} />ปิดใช้งาน (Inactive)</label></div></fieldset>
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{error}</p>}
      <div className="flex justify-end gap-2 border-t pt-3"><button type="button" onClick={() => setSectionEditor(null)} className={`${buttonClass} bg-slate-100 text-slate-600`}>ยกเลิก</button><button className={`${buttonClass} bg-blue-600 text-white`}><Check className="h-4 w-4" />เปิดตอนเรียน</button></div>
    </form></Modal>

    <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.type === 'courses' ? 'รายละเอียดรายวิชา' : 'รายละเอียดตอนเรียน'} maxWidth="4xl">{detail && <div className="space-y-5 text-sm"><dl className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">{[['รหัสวิชา', detail.course.courseCode], ['ชื่อวิชา', detail.course.courseName], ['คณะ', detail.course.faculty], ['ภาควิชา', detail.course.department], ['สถานะ', detail.course.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>{detail.type === 'courses' ? <OfferingHistory course={detail.course} teachers={teachers} students={students} academicState={academicState} /> : detail.section && <SectionSummary course={detail.course} section={detail.section} teachers={teachers} students={students} academicState={academicState} />}</div>}</Modal>

    <Modal isOpen={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.action === 'delete' ? 'ยืนยันการลบ' : 'ยืนยันการเปลี่ยนสถานะ'}>{confirm && (() => { const sectionId = confirm.section ? sectionIdOf(confirm.course.id, confirm.section) : ''; const guard = confirm.action === 'delete' ? confirm.type === 'courses' ? courseDeleteError(confirm.course, examSessions) : sectionDeleteError(confirm.course, confirm.section!, examSessions) : undefined; return <div className="space-y-4 text-sm">{guard ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-800"><AlertTriangle className="mb-2 h-5 w-5" />{guard}</p> : <p>ยืนยัน{confirm.action === 'delete' ? 'ลบ' : (confirm.type === 'courses' ? confirm.course.status : confirm.section?.status) === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} “{confirm.type === 'courses' ? confirm.course.courseCode : `ตอนเรียนที่ ${confirm.section?.sectionNo}`}” หรือไม่?</p>}<div className="flex justify-end gap-2"><button className={`${buttonClass} border`} onClick={() => setConfirm(null)}>{guard ? 'ปิด' : 'ยกเลิก'}</button>{!guard && <button className={`${buttonClass} bg-blue-600 text-white`} onClick={() => { const success = confirm.type === 'courses' ? confirm.action === 'delete' ? deleteCourse(confirm.course.id) : saveCourseRecord({ code: confirm.course.courseCode, name: confirm.course.courseName, facultyId: confirm.course.facultyId || '', departmentId: confirm.course.departmentId || '', status: confirm.course.status === 'active' ? 'inactive' : 'active' }, confirm.course.id).success : confirm.action === 'delete' ? deleteSectionRecord(sectionId).success : setSectionStatus(sectionId, confirm.section?.status === 'inactive' ? 'active' : 'inactive').success; if (success) setConfirm(null); }}>ยืนยัน</button>}</div></div>; })()}</Modal>
  </div>;
};

const OfferingHistory: React.FC<{ course: Course; teachers: ReturnType<typeof useApp>['teachers']; students: ReturnType<typeof useApp>['students']; academicState: ReturnType<typeof useApp>['academicState'] }> = ({ course, teachers, students, academicState }) => {
  const teacherIds = [...new Set(course.sections.flatMap((section) =>
    [section.primaryTeacherId || section.teacherId, ...(section.coTeacherIds || [])]).filter(Boolean))];
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border p-3"><span className="text-xs text-slate-500">ตอนเรียนทั้งหมด</span><strong className="mt-1 block text-xl">{course.sections.length}</strong></div>
      <div className="rounded-xl border p-3"><span className="text-xs text-slate-500">ตอนเรียนที่เปิดใช้งาน</span><strong className="mt-1 block text-xl">{course.sections.filter((section) => section.status !== 'inactive').length}</strong></div>
      <div className="rounded-xl border p-3"><span className="text-xs text-slate-500">อาจารย์ผู้สอน</span><strong className="mt-1 block text-xl">{teacherIds.length}</strong></div>
    </div>
    <div><h3 className="mb-2 font-bold">รายชื่ออาจารย์ผู้สอน</h3><p className="text-xs text-slate-600">{teacherIds.map((id) => teachers.find((teacher) => teacher.id === id)?.fullName).filter(Boolean).join(', ') || 'ยังไม่มีอาจารย์ผู้สอน'}</p></div>
    <div className="overflow-x-auto"><h3 className="mb-3 font-bold">ประวัติการเปิดสอน</h3><table className="w-full min-w-[720px] text-xs"><thead className="bg-slate-50"><tr><th className="p-3">ภาคการศึกษา</th><th className="p-3">ปีการศึกษา</th><th className="p-3">ตอนเรียน</th><th className="p-3">อาจารย์ผู้สอน</th><th className="p-3">สาขาวิชา / ปีที่เข้าศึกษา / กลุ่มเรียน</th><th className="p-3">นักศึกษา</th></tr></thead><tbody>{course.sections.map((section) => <tr key={sectionIdOf(course.id, section)} className="border-t text-center"><td className="p-3">{semesterLabel(section.semester)}</td><td>{section.academicYear}</td><td>ตอนเรียนที่ {section.sectionNo}</td><td>{teachers.find((teacher) => teacher.id === (section.primaryTeacherId || section.teacherId))?.fullName || '—'}</td><td>{(section.cohorts || []).map((cohort) => formatCohortLabel(cohort, academicState)).join(', ') || '—'}</td><td>{sectionStudentCount(students, section)}</td></tr>)}</tbody></table></div>
  </div>;
};

const SectionSummary: React.FC<{ course: Course; section: Section; teachers: ReturnType<typeof useApp>['teachers']; students: ReturnType<typeof useApp>['students']; academicState: ReturnType<typeof useApp>['academicState'] }> = ({ course, section, teachers, students, academicState }) => <dl className="grid gap-3 sm:grid-cols-2">{[
  ['ตอนเรียน', `ตอนเรียนที่ ${section.sectionNo}`], ['ภาคการศึกษา / ปี', `${semesterLabel(section.semester)} / ${section.academicYear}`],
  ['อาจารย์ผู้สอนหลัก', teachers.find((teacher) => teacher.id === (section.primaryTeacherId || section.teacherId))?.fullName || '—'],
  ['อาจารย์ผู้สอนร่วม', (section.coTeacherIds || []).map((id) => teachers.find((teacher) => teacher.id === id)?.fullName).filter(Boolean).join(', ') || '—'],
  ['สาขาวิชา / ปีที่เข้าศึกษา / กลุ่มเรียน', (section.cohorts || []).map((cohort) => formatCohortLabel(cohort, academicState)).join(', ') || '—'],
  ['จำนวนนักศึกษา', `${sectionStudentCount(students, section)} คน`],
].map(([label, value]) => <div key={label} className="rounded-xl border p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>;
