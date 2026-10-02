export type AcademicStatus = 'active' | 'inactive';

interface AcademicRecordBase {
  id: string;
  status: AcademicStatus;
  updatedAt: string;
}

export interface FacultyRecord extends AcademicRecordBase { code: string; name: string; }
export interface DepartmentRecord extends AcademicRecordBase { facultyId: string; code: string; name: string; }
export interface MajorRecord extends AcademicRecordBase { departmentId: string; code: string; name: string; }
export interface ClassGroupRecord extends AcademicRecordBase {
  majorId: string;
  admissionYear: number;
  sequence: number;
  code: string;
  name: string;
}

export interface AcademicState {
  faculties: FacultyRecord[];
  departments: DepartmentRecord[];
  majors: MajorRecord[];
  /** Lightweight student grouping; not a fourth canonical hierarchy level. */
  classGroups: ClassGroupRecord[];
  /** Highest sequence ever issued per Major + admission year, including deleted groups. */
  classGroupSequenceCounters: Record<string, number>;
}

export type AcademicTier = 'faculties' | 'departments' | 'majors' | 'classGroups';
export type AcademicRecord = AcademicState[AcademicTier][number];
export interface AcademicInput {
  name: string;
  code: string;
  facultyId: string;
  departmentId: string;
  majorId?: string;
  admissionYear?: number;
  status: AcademicStatus;
}
export interface AcademicResult { success: boolean; error?: string; }
