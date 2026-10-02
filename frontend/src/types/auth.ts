import type { Role } from '../types';

export type UniversityAccountDomain = 'student' | 'staff' | 'unsupported';

/** The active scan uses not_started → scanning → verified_mock; older phases remain readable. */
export type FaceEnrollmentStatus =
  | 'not_started'
  | 'scanning'
  // Former second-checklist state is retained only for persisted compatibility.
  | 'verifying'
  // Older mock phases remain readable for forward migration.
  | 'capturing'
  | 'captured'
  | 'verified_mock';

export interface MockAuthUser {
  id: string;
  email: string;
  role: Role;
  subjectId: string;
  registered: boolean;
  faceEnrollmentStatus: FaceEnrollmentStatus;
  /** Frontend demo credential only. Browser-managed plaintext is NOT production-safe. */
  mockPassword?: string;
  /** Admin accounts must be provisioned by the system; the public UI cannot grant this role. */
  adminProvisioned?: boolean;
}

export interface MockGoogleAccountOption {
  email: string;
  label: string;
}

export interface UniversityAccountResolution {
  domain: UniversityAccountDomain;
  normalizedEmail: string;
}

export interface ParsedStudentUniversityEmail {
  studentId: string;
  admissionYear: number;
}

/** In-memory form state; only the final password is saved to the mock auth record. */
export interface RegistrationCredentialDraft {
  password: string;
  confirmation: string;
}

export interface MockAuthResolution extends UniversityAccountResolution {
  user?: MockAuthUser;
  error?: string;
}
