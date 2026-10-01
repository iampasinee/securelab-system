import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Edit2,
  Eye,
  GraduationCap,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AccountStatus, Teacher, UserRole } from '../../types';
import { AcademicState } from '../../types/academic';
import { validateTeacherAffiliation } from '../../services/academicState';
import { UserManagementView } from '../../utils/adminRoutes';
import { AccountStatusBadge, Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { StudentEditorForm, StudentManagement } from './StudentManagement';
import { AcademicCascade } from './AcademicCascade';

interface UserRoleManagerProps {
  view: UserManagementView;
}

interface UnifiedUser {
  id: string;
  code: string;
  name: string;
  email: string;
  role: UserRole;
  faculty: string;
  facultyId?: string;
  department: string;
  departmentId?: string;
  status: AccountStatus;
  year?: number;
  faceReferenceUrl?: string;
  isFirstTime?: boolean;
  icitProfileStatus?: 'confirmed' | 'pending';
  assignedCourses: string[];
}

type SortKey = 'code' | 'name' | 'email' | 'role' | 'faculty' | 'department' | 'year' | 'status';
type SortDirection = 'asc' | 'desc';

interface UserFormState {
  code: string;
  name: string;
  email: string;
  faculty: string;
  facultyId: string;
  department: string;
  departmentId: string;
  year: number;
}

const pageSize = 10;

const createEmptyForm = (): UserFormState => ({
  code: '',
  name: '',
  email: '',
  faculty: '',
  facultyId: '',
  department: '',
  departmentId: '',
  year: 1,
});

const GeneralUserRoleManager: React.FC<UserRoleManagerProps> = ({ view }) => {
  const {
    students,
    teachers,
    admins,
    courses,
    academicState,
    currentAdmin,
    addTeacher,
    addAdmin,
    updateStudent,
    updateTeacher,
    updateAdmin,
    updateAccountStatus,
    deleteStudent,
    deleteTeacher,
    deleteAdmin,
    language,
  } = useApp();
  const isThai = language === 'th';

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [faceFilter, setFaceFilter] = useState<'all' | 'registered' | 'missing'>('all');
  const [icitFilter, setIcitFilter] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [viewUser, setViewUser] = useState<UnifiedUser | null>(null);
  const [editUser, setEditUser] = useState<UnifiedUser | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(createEmptyForm);
  const [statusUser, setStatusUser] = useState<UnifiedUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<AccountStatus>('suspended');
  const [statusReason, setStatusReason] = useState('');
  const [deleteUser, setDeleteUser] = useState<UnifiedUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState<UserRole | null>(null);
  const [createForm, setCreateForm] = useState<UserFormState>(createEmptyForm);

  const allUsers = useMemo<UnifiedUser[]>(() => [
    ...students.map((student) => ({
      id: student.id,
      code: student.studentCode,
      name: student.fullName,
      email: student.email,
      role: 'student' as const,
      faculty: student.faculty,
      department: student.department,
      status: student.accountStatus,
      year: student.year,
      faceReferenceUrl: student.faceReferenceUrl,
      isFirstTime: student.isFirstTime,
      assignedCourses: [],
    })),
    ...teachers.map((teacher) => {
      const department = academicState.departments.find((item) => item.id === teacher.departmentId);
      const faculty = academicState.faculties.find((item) => item.id === department?.facultyId);
      return {
        id: teacher.id,
        code: teacher.teacherCode,
        name: teacher.fullName,
        email: teacher.email,
        role: 'teacher' as const,
        faculty: faculty?.name || teacher.faculty || '—',
        facultyId: faculty?.id || teacher.facultyId,
        department: department?.name || teacher.department || '—',
        departmentId: department?.id || teacher.departmentId,
        status: teacher.accountStatus,
        icitProfileStatus: teacher.icitProfileStatus,
        assignedCourses: courses
          .filter((course) => course.sections.some((section) =>
            (section.primaryTeacherId || section.teacherId) === teacher.id || section.coTeacherIds?.includes(teacher.id)))
          .map((course) => course.courseCode),
      };
    }),
    ...admins.map((admin) => ({
      id: admin.id,
      code: admin.adminCode,
      name: admin.fullName,
      email: admin.email,
      role: 'admin' as const,
      faculty: '—',
      department: '—',
      status: admin.accountStatus,
      assignedCourses: [],
    })),
  ], [students, teachers, admins, courses, academicState]);

  const viewRole: UserRole | null = view === 'students'
    ? 'student'
    : view === 'teachers'
    ? 'teacher'
    : view === 'admins'
    ? 'admin'
    : null;

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return allUsers
      .filter((user) => !viewRole || user.role === viewRole)
      .filter((user) => view !== 'overview' || roleFilter === 'all' || user.role === roleFilter)
      .filter((user) => statusFilter === 'all' || user.status === statusFilter)
      .filter((user) => view !== 'students' || faceFilter === 'all' || (
        faceFilter === 'registered' ? Boolean(user.faceReferenceUrl) : !user.faceReferenceUrl
      ))
      .filter((user) => view !== 'teachers' || icitFilter === 'all' || user.icitProfileStatus === icitFilter)
      .filter((user) => !normalizedSearch || [user.code, user.name, user.email, user.faculty, user.department]
        .some((value) => value.toLowerCase().includes(normalizedSearch)))
      .sort((left, right) => {
        const leftValue = sortKey === 'year' ? left.year || 0 : left[sortKey];
        const rightValue = sortKey === 'year' ? right.year || 0 : right[sortKey];
        const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [allUsers, viewRole, view, roleFilter, statusFilter, faceFilter, icitFilter, searchTerm, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
    setRoleFilter('all');
    setStatusFilter('all');
    setFaceFilter('all');
    setIcitFilter('all');
  }, [view]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, statusFilter, faceFilter, icitFilter, sortKey, sortDirection]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const roleLabel = (role: UserRole) => {
    if (role === 'student') return isThai ? 'นักศึกษา' : 'Student';
    if (role === 'teacher') return isThai ? 'อาจารย์' : 'Teacher';
    return isThai ? 'ผู้ดูแลระบบ' : 'Admin';
  };

  const statusLabel = (status: AccountStatus) => {
    if (status === 'active') return isThai ? 'ใช้งานอยู่' : 'Active';
    if (status === 'suspended') return isThai ? 'ระงับสิทธิ์' : 'Suspended';
    return isThai ? 'สิ้นสุด/ลาออก' : 'Terminated/Resigned';
  };

  const roleBadge = (role: UserRole) => (
    <Badge variant={role === 'admin' ? 'danger' : role === 'teacher' ? 'purple' : 'blue'} size="sm">
      {roleLabel(role)}
    </Badge>
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortHeader = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="inline-flex cursor-pointer items-center gap-1 font-semibold hover:text-blue-700"
    >
      {label}
      <ChevronsUpDown className={`h-3.5 w-3.5 ${sortKey === key ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );

  const isCurrentAdmin = (user: UnifiedUser) => user.role === 'admin' && user.id === currentAdmin?.id;

  const openEditModal = (user: UnifiedUser) => {
    setEditUser(user);
    setEditForm({
      code: user.code,
      name: user.name,
      email: user.email,
      faculty: user.faculty === '—' ? '' : user.faculty,
      facultyId: user.facultyId || '',
      department: user.department === '—' ? '' : user.department,
      departmentId: user.departmentId || '',
      year: user.year || 1,
    });
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editUser) return;
    if (editUser.role === 'student') {
      const accepted = updateStudent(editUser.id, {
        studentCode: editForm.code.trim(),
        fullName: editForm.name.trim(),
        email: editForm.email.trim(),
        faculty: editForm.faculty.trim(),
        department: editForm.department.trim(),
      });
      if (!accepted) return;
    } else if (editUser.role === 'teacher') {
      const accepted = updateTeacher(editUser.id, {
        teacherCode: editForm.code.trim(),
        fullName: editForm.name.trim(),
        email: editForm.email.trim(),
        facultyId: editForm.facultyId,
        departmentId: editForm.departmentId,
      });
      if (!accepted) return;
    } else {
      updateAdmin(editUser.id, {
        adminCode: editForm.code.trim(),
        fullName: editForm.name.trim(),
        email: editForm.email.trim(),
      });
    }
    setEditUser(null);
  };

  const openStatusModal = (user: UnifiedUser) => {
    if (isCurrentAdmin(user)) return;
    setStatusUser(user);
    setStatusTarget(user.status === 'active' ? 'suspended' : 'active');
    setStatusReason('');
  };

  const applyStatus = (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusUser || isCurrentAdmin(statusUser)) return;
    if (statusUser.role === 'student') {
      updateAccountStatus(statusUser.id, statusTarget, statusReason.trim() || undefined);
    } else if (statusUser.role === 'teacher') {
      updateTeacher(statusUser.id, { accountStatus: statusTarget });
    } else {
      updateAdmin(statusUser.id, { accountStatus: statusTarget });
    }
    setStatusUser(null);
  };

  const confirmDelete = () => {
    if (!deleteUser || isCurrentAdmin(deleteUser)) return;
    const deleted = deleteUser.role === 'student'
      ? deleteStudent(deleteUser.id)
      : deleteUser.role === 'teacher'
      ? deleteTeacher(deleteUser.id)
      : deleteAdmin(deleteUser.id);
    if (deleted) setDeleteUser(null);
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreateRole(null);
    setCreateForm(createEmptyForm());
  };

  const returnToRoleSelection = () => {
    setCreateRole(null);
    setCreateForm(createEmptyForm());
  };

  const createUser = (event: React.FormEvent) => {
    event.preventDefault();
    if (!createRole) return;
    if (createRole === 'student') return;
    if (createRole === 'teacher') {
      const accepted = addTeacher({
        teacherCode: createForm.code.trim(),
        fullName: createForm.name.trim(),
        email: createForm.email.trim(),
        facultyId: createForm.facultyId,
        departmentId: createForm.departmentId,
        faculty: '',
        department: '',
        role: 'teacher',
        icitProfileStatus: 'confirmed',
        accountStatus: 'active',
      });
      if (!accepted) return;
    } else {
      addAdmin({
        adminCode: createForm.code.trim(),
        fullName: createForm.name.trim(),
        email: createForm.email.trim(),
        role: 'admin',
        accountStatus: 'active',
      });
    }
    closeCreateModal();
  };

  const titles = {
    overview: {
      eyebrow: isThai ? 'การจัดการระบบผู้ใช้งาน' : 'USER ADMINISTRATION',
      title: isThai ? 'ภาพรวมผู้ใช้งาน' : 'User Overview',
      subtitle: isThai ? 'ตรวจสอบและจัดการข้อมูลผู้ใช้งานทุกประเภทภายในระบบ' : 'Review and manage every type of system user.',
      button: isThai ? 'เพิ่มผู้ใช้งาน' : 'Create User',
      accent: 'text-blue-600',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
    students: {
      eyebrow: isThai ? 'ระบบจัดการผู้เข้าสอบ' : 'STUDENT MANAGEMENT',
      title: isThai ? 'จัดการข้อมูลนักศึกษา' : 'Student Management',
      subtitle: isThai ? 'จัดการข้อมูลนักศึกษาผู้เข้าสอบ ตรวจสอบสถานะการเชื่อมโยงใบหน้าชีวมิติ และสิทธิ์การสอบ' : 'Manage examinee accounts, biometric references, and exam access.',
      button: isThai ? 'เพิ่มนักศึกษา' : 'Add Student',
      accent: 'text-blue-600',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
    teachers: {
      eyebrow: isThai ? 'การจัดการผู้คุมสอบ' : 'TEACHER DIRECTORY',
      title: isThai ? 'จัดการข้อมูลอาจารย์' : 'Teacher Management',
      subtitle: isThai ? 'จัดการข้อมูลอาจารย์ผู้คุมสอบ การยืนยันตัวตน ICIT และรายวิชาที่รับผิดชอบ' : 'Manage proctor accounts, ICIT verification, and assigned courses.',
      button: isThai ? 'เพิ่มอาจารย์' : 'Add Teacher',
      accent: 'text-purple-600',
      buttonClass: 'bg-purple-600 hover:bg-purple-700',
    },
    admins: {
      eyebrow: isThai ? 'การจัดการสิทธิ์ระบบขั้นสูง' : 'SYSTEM ADMINISTRATORS',
      title: isThai ? 'จัดการข้อมูลผู้ดูแลระบบ' : 'Administrator Management',
      subtitle: isThai ? 'จัดการบัญชีผู้ดูแลระบบ ยืนยันตัวตนดิจิทัล และสิทธิ์การควบคุมระดับโครงสร้างพื้นฐาน' : 'Manage administrator identities and infrastructure-level privileges.',
      button: isThai ? 'เพิ่มผู้ดูแลระบบ' : 'Add Admin',
      accent: 'text-red-600',
      buttonClass: 'bg-red-600 hover:bg-red-700',
    },
  }[view];

  const overviewMetrics = [
    { label: isThai ? 'ผู้ใช้ทั้งหมด' : 'Total Users', value: allUsers.length, note: isThai ? 'บัญชีในระบบ' : 'system accounts', icon: Users, iconClass: 'text-blue-600', valueClass: 'text-gray-900' },
    { label: isThai ? 'นักศึกษา' : 'Students', value: students.length, note: isThai ? 'ดูรายชื่อ →' : 'view list →', icon: GraduationCap, iconClass: 'text-blue-600', valueClass: 'text-gray-900' },
    { label: isThai ? 'อาจารย์' : 'Teachers', value: teachers.length, note: isThai ? 'ดูรายชื่อ →' : 'view list →', icon: BriefcaseBusiness, iconClass: 'text-purple-600', valueClass: 'text-gray-900' },
    { label: isThai ? 'ผู้ดูแลระบบ' : 'Admins', value: admins.length, note: isThai ? 'ดูรายชื่อ →' : 'view list →', icon: Shield, iconClass: 'text-red-600', valueClass: 'text-gray-900' },
    { label: isThai ? 'ใช้งานปกติ' : 'Active', value: allUsers.filter((user) => user.status === 'active').length, note: isThai ? 'พร้อมเข้าสอบ' : 'ready for access', icon: CheckCircle2, iconClass: 'text-emerald-600', valueClass: 'text-emerald-600' },
    { label: isThai ? 'ระงับสิทธิ์' : 'Suspended', value: allUsers.filter((user) => user.status === 'suspended').length, note: isThai ? 'ถูกจำกัดสิทธิ์' : 'access restricted', icon: AlertTriangle, iconClass: 'text-red-600', valueClass: 'text-red-600' },
    { label: isThai ? 'พ้นสภาพ/จบ' : 'Inactive', value: allUsers.filter((user) => user.status === 'graduated_inactive').length, note: isThai ? 'ไม่สามารถสอบได้' : 'cannot sign in', icon: ShieldCheck, iconClass: 'text-gray-500', valueClass: 'text-gray-600' },
  ];
  const studentMetrics = [
    { label: isThai ? 'นักศึกษาทั้งหมด' : 'Total Students', value: students.length, note: isThai ? 'บัญชีในระบบ' : 'system accounts', icon: GraduationCap, iconClass: 'text-blue-600', valueClass: 'text-gray-900' },
    { label: isThai ? 'สถานะปกติ' : 'Active', value: students.filter((student) => student.accountStatus === 'active').length, note: isThai ? 'พร้อมเข้าสอบ' : 'ready for exams', icon: CheckCircle2, iconClass: 'text-emerald-600', valueClass: 'text-emerald-600' },
    { label: isThai ? 'ระงับสิทธิ์' : 'Suspended', value: students.filter((student) => student.accountStatus === 'suspended').length, note: isThai ? 'ถูกจำกัดสิทธิ์' : 'access restricted', icon: AlertTriangle, iconClass: 'text-red-600', valueClass: 'text-red-600' },
    { label: isThai ? 'มีภาพถ่ายชีวมิติ' : 'Face References', value: students.filter((student) => Boolean(student.faceReferenceUrl)).length, note: isThai ? 'ลงทะเบียนแล้ว' : 'registered', icon: Camera, iconClass: 'text-purple-600', valueClass: 'text-purple-600' },
  ];
  const teacherMetrics = [
    { label: isThai ? 'อาจารย์ทั้งหมด' : 'Total Teachers', value: teachers.length, note: isThai ? 'ผู้สอนในระบบ' : 'faculty accounts', icon: BriefcaseBusiness, iconClass: 'text-purple-600', valueClass: 'text-gray-900' },
    { label: isThai ? 'สถานะปกติ' : 'Active', value: teachers.filter((teacher) => teacher.accountStatus === 'active').length, note: isThai ? 'พร้อมคุมสอบ' : 'ready to proctor', icon: CheckCircle2, iconClass: 'text-emerald-600', valueClass: 'text-emerald-600' },
    { label: isThai ? 'ยืนยัน ICIT แล้ว' : 'ICIT Confirmed', value: teachers.filter((teacher) => teacher.icitProfileStatus === 'confirmed').length, note: isThai ? 'โปรไฟล์สมบูรณ์' : 'profile complete', icon: ShieldCheck, iconClass: 'text-blue-600', valueClass: 'text-blue-600' },
    { label: isThai ? 'รอยืนยันโปรไฟล์' : 'Pending Profile', value: teachers.filter((teacher) => teacher.icitProfileStatus === 'pending').length, note: isThai ? 'ต้องเข้าระบบครั้งแรก' : 'first login required', icon: AlertTriangle, iconClass: 'text-amber-600', valueClass: 'text-amber-600' },
  ];
  const adminMetrics = [
    { label: isThai ? 'ผู้ดูแลระบบทั้งหมด' : 'Total Admins', value: admins.length, note: isThai ? 'สิทธิ์ระดับโครงสร้างพื้นฐาน' : 'infrastructure access', icon: Shield, iconClass: 'text-red-600', valueClass: 'text-gray-900' },
    { label: isThai ? 'สถานะปกติ' : 'Active', value: admins.filter((admin) => admin.accountStatus === 'active').length, note: isThai ? 'ปฏิบัติการได้เต็มรูปแบบ' : 'fully operational', icon: CheckCircle2, iconClass: 'text-emerald-600', valueClass: 'text-emerald-600' },
    { label: isThai ? 'ระงับสิทธิ์' : 'Suspended', value: admins.filter((admin) => admin.accountStatus === 'suspended').length, note: isThai ? 'ถูกระงับสิทธิ์' : 'access suspended', icon: AlertTriangle, iconClass: 'text-red-600', valueClass: 'text-red-600' },
  ];
  const metrics = view === 'overview'
    ? overviewMetrics
    : view === 'students'
    ? studentMetrics
    : view === 'teachers'
    ? teacherMetrics
    : adminMetrics;
  const metricGridClass = view === 'overview' ? 'xl:grid-cols-7' : view === 'admins' ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  const tableColumnCount = view === 'admins' ? 5 : view === 'overview' ? 7 : 8;

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-col justify-between gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider ${titles.accent}`}>
            {titles.eyebrow}
          </span>
          <h1 className="mt-0.5 text-2xl font-bold text-gray-900">{titles.title}</h1>
          <p className="mt-1 text-xs text-gray-500">{titles.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateRole(viewRole);
            setCreateOpen(true);
          }}
          className={`flex cursor-pointer items-center gap-2 self-start rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-colors sm:self-auto ${titles.buttonClass}`}
        >
          <Plus className="h-4 w-4" />
          <span>{titles.button}</span>
        </button>
      </header>

      {view === 'admins' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <strong>{isThai ? 'ข้อกำหนดความปลอดภัย: ' : 'Security Constraint: '}</strong>
            {isThai
              ? 'ระบบจะไม่อนุญาตให้ลบหรือระงับสิทธิ์บัญชีผู้ดูแลระบบที่กำลังเข้าสู่ระบบอยู่ในปัจจุบัน'
              : 'The currently authenticated administrator cannot be deleted or suspended.'}
          </p>
        </div>
      )}

      <section className={`grid grid-cols-2 gap-3 ${metricGridClass}`} aria-label={isThai ? 'สรุปจำนวนผู้ใช้งาน' : 'User metrics'}>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="relative min-h-24 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
              <Icon className={`absolute top-4 right-4 h-4 w-4 ${metric.iconClass}`} />
              <div className="pr-6 text-[11px] font-medium text-gray-500">{metric.label}</div>
              <div className={`mt-2 font-mono text-2xl font-bold ${metric.valueClass}`}>{metric.value}</div>
              <div className={`mt-1 text-[10px] ${metric.iconClass}`}>{metric.note}</div>
            </article>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-xs lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isThai ? 'ค้นหาด้วยรหัสประจำตัว, ชื่อ-นามสกุล, อีเมล หรือภาควิชา...' : 'Search by ID, full name, email, or department...'}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pr-4 pl-9 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            {view === 'overview' && (
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{isThai ? 'ทุกบทบาท' : 'All roles'}</option>
                <option value="student">{isThai ? 'นักศึกษา' : 'Students'}</option>
                <option value="teacher">{isThai ? 'อาจารย์' : 'Teachers'}</option>
                <option value="admin">{isThai ? 'ผู้ดูแลระบบ' : 'Admins'}</option>
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AccountStatus | 'all')}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{isThai ? 'ทุกสถานะ' : 'All statuses'}</option>
              <option value="active">{statusLabel('active')}</option>
              <option value="suspended">{statusLabel('suspended')}</option>
              <option value="graduated_inactive">{statusLabel('graduated_inactive')}</option>
            </select>
            {view === 'students' && (
              <select
                value={faceFilter}
                onChange={(event) => setFaceFilter(event.target.value as 'all' | 'registered' | 'missing')}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{isThai ? 'ภาพถ่ายชีวมิติทั้งหมด' : 'All biometric photos'}</option>
                <option value="registered">{isThai ? 'ยืนยันแล้ว' : 'Registered'}</option>
                <option value="missing">{isThai ? 'ยังไม่มีภาพ' : 'Missing photo'}</option>
              </select>
            )}
            {view === 'teachers' && (
              <select
                value={icitFilter}
                onChange={(event) => setIcitFilter(event.target.value as 'all' | 'confirmed' | 'pending')}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">{isThai ? 'ICIT: ทุกการยืนยัน' : 'ICIT: All verification'}</option>
                <option value="confirmed">{isThai ? 'ยืนยันแล้ว' : 'Confirmed'}</option>
                <option value="pending">{isThai ? 'รอยืนยัน' : 'Pending'}</option>
              </select>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3.5">{sortHeader('code', isThai ? 'รหัส' : 'ID')}</th>
                  <th className="px-4 py-3.5">{sortHeader('name', isThai ? 'ชื่อ-นามสกุล' : 'Full Name')}</th>
                  <th className="px-4 py-3.5">{sortHeader('email', isThai ? 'อีเมลมหาวิทยาลัย' : 'University Email')}</th>
                  {view === 'overview' && <th className="px-4 py-3.5">{sortHeader('role', isThai ? 'บทบาท / ประเภท' : 'Role / Type')}</th>}
                  {view !== 'admins' && (
                    <th className="px-4 py-3.5">{sortHeader('department', isThai ? 'คณะ / ภาควิชา' : 'Faculty / Department')}</th>
                  )}
                  {view === 'students' && <th className="px-4 py-3.5">{sortHeader('year', isThai ? 'ชั้นปี' : 'Year')}</th>}
                  {view === 'students' && <th className="px-4 py-3.5">{isThai ? 'ภาพถ่ายชีวมิติ' : 'Biometric Photo'}</th>}
                  {view === 'teachers' && <th className="px-4 py-3.5">{isThai ? 'รายวิชาที่รับผิดชอบ' : 'Assigned Courses'}</th>}
                  {view === 'teachers' && <th className="px-4 py-3.5">{isThai ? 'สถานะ ICIT' : 'ICIT Status'}</th>}
                  <th className="px-4 py-3.5">{sortHeader('status', isThai ? 'สถานะบัญชี' : 'Account Status')}</th>
                  <th className="px-4 py-3.5 text-right">{isThai ? 'การจัดการ' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedUsers.map((user) => {
                  const protectedAdmin = isCurrentAdmin(user);
                  return (
                    <tr key={`${user.role}-${user.id}`} className="transition-colors hover:bg-gray-50/70">
                      <td className="px-4 py-3.5 font-mono font-semibold text-gray-800">{user.code}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{user.name}</span>
                          {view === 'students' && user.isFirstTime && (
                            <Badge variant="warning" size="sm">{isThai ? 'รอลงทะเบียน' : 'Enrollment pending'}</Badge>
                          )}
                          {view === 'admins' && protectedAdmin && (
                            <Badge variant="warning" size="sm">{isThai ? 'บัญชีปัจจุบัน (คุณ)' : 'Current account (you)'}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-gray-500">{user.email}</td>
                      {view === 'overview' && <td className="px-4 py-3.5">{roleBadge(user.role)}</td>}
                      {view !== 'admins' && (
                        <td className="px-4 py-3.5 text-gray-600">
                          <div>{user.department}</div>
                          <div className="mt-0.5 text-[10px] text-gray-400">{user.faculty}</div>
                        </td>
                      )}
                      {view === 'students' && <td className="px-4 py-3.5 text-center text-gray-700">{user.year}</td>}
                      {view === 'students' && (
                        <td className="px-4 py-3.5">
                          {user.faceReferenceUrl ? (
                            <div className="flex items-center gap-2">
                              <img src={user.faceReferenceUrl} alt="" className="h-7 w-7 rounded-full border border-emerald-300 object-cover" />
                              <span className="whitespace-nowrap text-[10px] font-semibold text-emerald-700">{isThai ? 'ยืนยันแล้ว' : 'Verified'}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-amber-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {isThai ? 'ยังไม่มีภาพ' : 'Missing photo'}
                            </span>
                          )}
                        </td>
                      )}
                      {view === 'teachers' && (
                        <td className="px-4 py-3.5">
                          <div className="flex max-w-44 flex-wrap gap-1">
                            {user.assignedCourses.length
                              ? user.assignedCourses.map((courseCode) => <Badge key={courseCode} variant="purple" size="sm">{courseCode}</Badge>)
                              : '—'}
                          </div>
                        </td>
                      )}
                      {view === 'teachers' && (
                        <td className="px-4 py-3.5">
                          <Badge variant={user.icitProfileStatus === 'confirmed' ? 'success' : 'warning'} size="sm">
                            {user.icitProfileStatus === 'confirmed'
                              ? (isThai ? 'ยืนยันแล้ว' : 'Confirmed')
                              : (isThai ? 'รอยืนยัน' : 'Pending')}
                          </Badge>
                        </td>
                      )}
                      <td className="px-4 py-3.5"><AccountStatusBadge status={user.status} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => setViewUser(user)} className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800" title={isThai ? 'ดูข้อมูล' : 'View'}>
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => openEditModal(user)} className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700" title={isThai ? 'แก้ไข' : 'Edit'}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openStatusModal(user)}
                            disabled={protectedAdmin}
                            className="cursor-pointer rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-70"
                            title={protectedAdmin
                              ? (isThai ? 'ไม่สามารถระงับบัญชีผู้ดูแลที่กำลังใช้งาน' : 'The active admin cannot be suspended')
                              : user.status === 'active' ? (isThai ? 'ระงับสิทธิ์' : 'Suspend') : (isThai ? 'เปิดใช้งานอีกครั้ง' : 'Reactivate')}
                          >
                            {user.status === 'active' ? <AlertTriangle className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => !protectedAdmin && setDeleteUser(user)}
                            disabled={protectedAdmin}
                            className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-70"
                            title={protectedAdmin
                              ? (isThai ? 'ไม่สามารถลบบัญชีผู้ดูแลที่กำลังใช้งาน' : 'The active admin cannot be deleted')
                              : (isThai ? 'ลบ' : 'Delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pagedUsers.length === 0 && (
                  <tr>
                    <td colSpan={tableColumnCount} className="px-6 py-12 text-center text-sm text-gray-400">
                      {isThai ? 'ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข' : 'No users match the current filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row">
            <span className="text-[11px] text-gray-500">
              {isThai
                ? `แสดง ${(page - 1) * pageSize + (pagedUsers.length ? 1 : 0)} - ${(page - 1) * pageSize + pagedUsers.length} จากทั้งหมด ${filteredUsers.length} รายการ`
                : `Showing ${pagedUsers.length} of ${filteredUsers.length} users`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={isThai ? 'หน้าก่อนหน้า' : 'Previous page'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-20 text-center text-xs font-medium text-gray-700">
                {isThai ? `หน้า ${page} / ${totalPages}` : `Page ${page} / ${totalPages}`}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={isThai ? 'หน้าถัดไป' : 'Next page'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)} title={isThai ? 'รายละเอียดผู้ใช้งาน' : 'User Details'} maxWidth="md">
        {viewUser && (
          <div className="space-y-4 text-left text-xs">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900">{viewUser.name}</div>
                <div className="font-mono text-gray-500">{viewUser.code}</div>
              </div>
              <div className="ml-auto">{roleBadge(viewUser.role)}</div>
            </div>
            {[
              [isThai ? 'อีเมลมหาวิทยาลัย' : 'University Email', viewUser.email],
              [isThai ? 'คณะ' : 'Faculty', viewUser.faculty],
              [isThai ? 'ภาควิชา' : 'Department', viewUser.department],
              [isThai ? 'สถานะบัญชี' : 'Account Status', statusLabel(viewUser.status)],
              ...(viewUser.role === 'student' ? [['ชั้นปี', viewUser.year ? `ชั้นปีที่ ${viewUser.year}` : '—']] : []),
              ...(viewUser.role === 'teacher' ? [[isThai ? 'รายวิชาที่รับผิดชอบ' : 'Assigned Courses', viewUser.assignedCourses.join(', ') || '—']] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-500">{label}</span>
                <span className="text-right font-medium text-gray-900">{value}</span>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setViewUser(null)} className="cursor-pointer rounded-xl bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200">
                {isThai ? 'ปิด' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={isThai ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'Edit User'} maxWidth="lg">
        {editUser && (
          <UserForm
            form={editForm}
            onChange={setEditForm}
            role={editUser.role}
            isThai={isThai}
            academicState={academicState}
            existingTeacher={editUser.role === 'teacher' ? teachers.find((teacher) => teacher.id === editUser.id) : undefined}
            onSubmit={saveEdit}
            onCancel={() => setEditUser(null)}
            submitLabel={isThai ? 'บันทึกการแก้ไข' : 'Save Changes'}
          />
        )}
      </Modal>

      <Modal isOpen={!!statusUser} onClose={() => setStatusUser(null)} title={isThai ? 'ยืนยันการเปลี่ยนสถานะ' : 'Confirm Status Change'} maxWidth="md">
        {statusUser && (
          <form onSubmit={applyStatus} className="space-y-4 text-left text-xs">
            <div className={`rounded-xl border p-4 ${statusTarget === 'suspended' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
              <div className="font-semibold">
                {statusTarget === 'suspended'
                  ? (isThai ? `ระงับสิทธิ์บัญชี ${statusUser.name}` : `Suspend ${statusUser.name}`)
                  : (isThai ? `เปิดใช้งานบัญชี ${statusUser.name}` : `Reactivate ${statusUser.name}`)}
              </div>
              <p className="mt-1 text-[11px] opacity-80">
                {statusTarget === 'suspended'
                  ? (isThai ? 'ผู้ใช้งานจะไม่สามารถเข้าถึงส่วนที่ต้องยืนยันสิทธิ์ได้' : 'The user will lose access to protected system flows.')
                  : (isThai ? 'ผู้ใช้งานจะสามารถเข้าสู่ระบบตามสิทธิ์ของบทบาทได้อีกครั้ง' : 'Role-based system access will be restored.')}
              </p>
            </div>
            {statusTarget === 'suspended' && statusUser.role === 'student' && (
              <div>
                <label className="mb-1 block font-semibold text-gray-700">{isThai ? 'เหตุผลการระงับสิทธิ์' : 'Suspension reason'}</label>
                <input
                  type="text"
                  required
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => setStatusUser(null)} className="cursor-pointer rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">{isThai ? 'ยกเลิก' : 'Cancel'}</button>
              <button type="submit" className={`cursor-pointer rounded-xl px-5 py-2 font-semibold text-white ${statusTarget === 'suspended' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isThai ? 'ยืนยัน' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title={isThai ? 'ยืนยันการลบผู้ใช้งาน' : 'Confirm User Deletion'} maxWidth="sm">
        {deleteUser && (
          <div className="space-y-4 text-left text-xs">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
              <div className="font-semibold">{isThai ? `ลบ ${deleteUser.name}?` : `Delete ${deleteUser.name}?`}</div>
              <p className="mt-1 text-[11px] text-red-700">
                {isThai ? 'ระบบจะตรวจสอบความสัมพันธ์ของข้อมูลด้วยข้อจำกัดเดิมก่อนลบ' : 'Existing data-relation safeguards will be checked before deletion.'}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteUser(null)} className="cursor-pointer rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">{isThai ? 'ยกเลิก' : 'Cancel'}</button>
              <button type="button" onClick={confirmDelete} className="cursor-pointer rounded-xl bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700">{isThai ? 'ลบผู้ใช้งาน' : 'Delete User'}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={createOpen} onClose={closeCreateModal} title={isThai ? 'เพิ่มผู้ใช้งาน' : 'Create User'} maxWidth={createRole === 'student' ? '4xl' : createRole ? 'lg' : 'md'}>
        {!createRole ? (
          <div className="space-y-3 text-left">
            <p className="text-xs text-gray-500">{isThai ? 'เลือกประเภทบัญชีที่ต้องการสร้าง' : 'Choose the type of account to create.'}</p>
            {([
              { role: 'student' as const, icon: GraduationCap, th: 'เพิ่มนักศึกษา', en: 'Add Student', color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { role: 'teacher' as const, icon: UserCog, th: 'เพิ่มอาจารย์', en: 'Add Teacher', color: 'text-purple-700 bg-purple-50 border-purple-200' },
              { role: 'admin' as const, icon: Shield, th: 'เพิ่มผู้ดูแลระบบ', en: 'Add Admin', color: 'text-red-700 bg-red-50 border-red-200' },
            ]).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => {
                    setCreateForm(createEmptyForm());
                    setCreateRole(option.role);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-gray-50"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${option.color}`}><Icon className="h-5 w-5" /></span>
                  <span className="font-semibold text-gray-900">{isThai ? option.th : option.en}</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
                </button>
              );
            })}
          </div>
        ) : createRole === 'student' ? (
          <StudentEditorForm
            onCancel={returnToRoleSelection}
            onSuccess={closeCreateModal}
            secondaryLabel="ย้อนกลับ"
          />
        ) : (
          <UserForm
            form={createForm}
            onChange={setCreateForm}
            role={createRole}
            isThai={isThai}
            academicState={academicState}
            onSubmit={createUser}
            onCancel={returnToRoleSelection}
            secondaryLabel="ย้อนกลับ"
            submitLabel={isThai ? 'สร้างบัญชีผู้ใช้' : 'Create Account'}
          />
        )}
      </Modal>
    </div>
  );
};

export const UserRoleManager: React.FC<UserRoleManagerProps> = ({ view }) => (
  view === 'students' ? <StudentManagement /> : <GeneralUserRoleManager view={view} />
);

interface UserFormProps {
  form: UserFormState;
  onChange: React.Dispatch<React.SetStateAction<UserFormState>>;
  role: UserRole;
  isThai: boolean;
  academicState: AcademicState;
  existingTeacher?: Teacher;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  secondaryLabel?: string;
  submitLabel: string;
}

const UserForm: React.FC<UserFormProps> = ({ form, onChange, role, isThai, academicState, existingTeacher, onSubmit, onCancel, secondaryLabel, submitLabel }) => {
  const teacherAffiliationError = role === 'teacher'
    ? validateTeacherAffiliation(academicState, form, existingTeacher)
    : undefined;

  return <form onSubmit={onSubmit} className="space-y-4 text-left text-xs">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="space-y-1 font-semibold text-gray-700">
        <span>{isThai ? 'รหัสประจำตัว' : 'Institutional ID'}</span>
        <input required value={form.code} onChange={(event) => onChange((current) => ({ ...current, code: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 font-mono font-normal focus:ring-2 focus:ring-blue-500" />
      </label>
      <label className="space-y-1 font-semibold text-gray-700">
        <span>{isThai ? 'ชื่อ-นามสกุล' : 'Full Name'}</span>
        <input required value={form.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 font-normal focus:ring-2 focus:ring-blue-500" />
      </label>
    </div>
    <label className="block space-y-1 font-semibold text-gray-700">
      <span>{isThai ? 'อีเมลมหาวิทยาลัย' : 'University Email'}</span>
      <input type="email" required value={form.email} onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 font-normal focus:ring-2 focus:ring-blue-500" />
    </label>
    {role === 'teacher' && (
      <AcademicCascade
        value={{ facultyId: form.facultyId, departmentId: form.departmentId, majorId: '' }}
        onChange={(selection) => onChange((current) => ({
          ...current,
          facultyId: selection.facultyId,
          departmentId: selection.departmentId,
          faculty: '',
          department: '',
        }))}
        depth={2}
        required
        retained={existingTeacher ? {
          facultyId: existingTeacher.facultyId || '',
          departmentId: existingTeacher.departmentId || '',
          majorId: '',
        } : undefined}
      />
    )}
    {role === 'student' && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 font-semibold text-gray-700">
          <span>{isThai ? 'คณะ' : 'Faculty'}</span>
          <input required value={form.faculty} onChange={(event) => onChange((current) => ({ ...current, faculty: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 font-normal focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="space-y-1 font-semibold text-gray-700">
          <span>{isThai ? 'ภาควิชา' : 'Department'}</span>
          <input required value={form.department} onChange={(event) => onChange((current) => ({ ...current, department: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 font-normal focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>
    )}
    {teacherAffiliationError && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-700">{teacherAffiliationError}</p>}
    {role === 'student' && (
      <label className="block space-y-1 font-semibold text-gray-700">
        <span>{isThai ? 'ชั้นปี' : 'Academic Year'}</span>
        <input readOnly value={form.year ? `ชั้นปีที่ ${form.year}` : '—'} className="w-full rounded-xl border border-gray-300 bg-slate-100 px-3 py-2" />
      </label>
    )}
    <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
      <button type="button" onClick={onCancel} className="cursor-pointer rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">{secondaryLabel || (isThai ? 'ยกเลิก' : 'Cancel')}</button>
      <button type="submit" disabled={Boolean(teacherAffiliationError)} className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{submitLabel}</button>
    </div>
  </form>;
};
