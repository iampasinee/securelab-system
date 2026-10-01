export const OFFICIAL_FACULTY_NAME = 'คณะเทคโนโลยีและการจัดการอุตสาหกรรม';

export interface AcademicClassGroup {
  id: string;
  code: string;
  yearLevel: number;
  academicYear?: number;
  studentIds?: string[];
  status?: 'active' | 'inactive';
  yearLevelId?: string;
}

export interface AcademicProgram {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  classGroups: AcademicClassGroup[];
  yearLevels?: { id: string; level: number; name: string; status: 'active' | 'inactive' }[];
  status?: 'active' | 'inactive';
}

export interface AcademicDepartment {
  id: string;
  code?: string;
  nameTh: string;
  nameEn: string;
  programs: AcademicProgram[];
  status?: 'active' | 'inactive';
}

export interface AcademicFaculty {
  id: string;
  name: string;
  status?: 'active' | 'inactive';
  departments: AcademicDepartment[];
}

export interface ResolvedAcademicPath {
  faculty: AcademicFaculty;
  department: AcademicDepartment;
  program: AcademicProgram;
  group: AcademicClassGroup;
}

export const academicStructure: AcademicFaculty[] = [
  {
    id: 'faculty-001',
    name: OFFICIAL_FACULTY_NAME,
    departments: [
      {
        id: 'department_it',
        code: 'IT',
        nameTh: 'ภาควิชาเทคโนโลยีสารสนเทศ',
        nameEn: 'Department of Information Technology',
        programs: [
          {
            id: 'program_inet',
            code: 'INET',
            nameTh: 'สาขาวิชาวิศวกรรมสารสนเทศและเครือข่าย',
            nameEn: 'Information and Network Engineering',
            classGroups: [
              {
                id: 'group_inet_de_ra',
                code: 'INET-DE-RA',
                yearLevel: 3,
                academicYear: 2569,
                studentIds: ['std_inet_ra_001', 'std_inet_ra_002'],
              },
              {
                id: 'group_inet_de_rb',
                code: 'INET-DE-RB',
                yearLevel: 3,
                academicYear: 2569,
                studentIds: ['std_inet_rb_001', 'std_inet_rb_002'],
              },
            ],
          },
          {
            id: 'program_ine',
            code: 'INE',
            nameTh: 'สาขาวิชาวิศวกรรมเครือข่ายและความปลอดภัย',
            nameEn: 'Network Engineering and Security',
            classGroups: [
              {
                id: 'group_ine_de_ra',
                code: 'INE-DE-RA',
                yearLevel: 3,
                academicYear: 2569,
                studentIds: ['std_ine_ra_001', 'std_ine_ra_002'],
              },
              {
                id: 'group_ine_de_rb',
                code: 'INE-DE-RB',
                yearLevel: 3,
                academicYear: 2569,
                studentIds: ['std_ine_rb_001', 'std_ine_rb_002'],
              },
              {
                id: 'group_ine_de_rc',
                code: 'INE-DE-RC',
                yearLevel: 3,
                academicYear: 2569,
                studentIds: ['std_ine_rc_001', 'std_ine_rc_002'],
              },
            ],
          },
          {
            id: 'prog_002',
            code: 'IT',
            nameTh: 'สาขาวิชาเทคโนโลยีสารสนเทศ',
            nameEn: 'Information Technology',
            classGroups: [
              { id: 'group_005', code: 'IT-DE-RA', yearLevel: 2 },
              { id: 'group_006', code: 'IT-DE-RB', yearLevel: 3 },
            ],
          },
        ],
      },
      {
        id: 'dep_002',
        nameTh: 'ภาควิชาวิศวกรรมอุตสาหการ',
        nameEn: 'Department of Industrial Engineering',
        programs: [
          {
            id: 'prog_003',
            code: 'IE',
            nameTh: 'สาขาวิชาวิศวกรรมอุตสาหการ',
            nameEn: 'Industrial Engineering',
            classGroups: [
              { id: 'group_007', code: 'IE-DE-RA', yearLevel: 2 },
            ],
          },
        ],
      },
      {
        id: 'dep_003',
        nameTh: 'ภาควิชาวิทยาการคอมพิวเตอร์',
        nameEn: 'Department of Computer Science',
        programs: [
          {
            id: 'prog_004',
            code: 'CS',
            nameTh: 'สาขาวิชาวิทยาการคอมพิวเตอร์',
            nameEn: 'Computer Science',
            classGroups: [
              { id: 'group_008', code: 'CS-DE-2A', yearLevel: 2 },
              { id: 'group_009', code: 'CS-DE-3A', yearLevel: 3 },
            ],
          },
        ],
      },
    ],
  },
];

const legacyGroupAliases: Record<string, string> = {
  group_001: 'group_inet_de_ra',
  group_002: 'group_inet_de_rb',
  group_003: 'group_inet_de_ra',
  group_004: 'group_inet_de_rb',
};

export const resolveAcademicGroupId = (groupId?: string) =>
  groupId ? legacyGroupAliases[groupId] || groupId : undefined;

export const findAcademicPathByGroup = (groupId?: string, hierarchy = academicStructure): ResolvedAcademicPath | null => {
  const resolvedGroupId = resolveAcademicGroupId(groupId);
  if (!resolvedGroupId) return null;
  for (const faculty of hierarchy) {
    for (const department of faculty.departments) {
      for (const program of department.programs) {
        const group = program.classGroups.find((item) => item.id === resolvedGroupId);
        if (group) return { faculty, department, program, group };
      }
    }
  }
  return null;
};

export const legacyStudentAcademicAssignments: Record<string, string> = {
  std_0001: 'group_inet_de_ra',
  std_0002: 'group_inet_de_ra',
  std_0003: 'group_008',
  std_0004: 'group_inet_de_ra',
  std_0005: 'group_inet_de_rb',
  std_0006: 'group_inet_de_ra',
  std_0007: 'group_inet_de_ra',
  std_0008: 'group_inet_de_rb',
  std_0009: 'group_inet_de_rb',
  std_0010: 'group_inet_de_rb',
  std_0011: 'group_inet_de_rb',
  std_0012: 'group_inet_de_rb',
};
