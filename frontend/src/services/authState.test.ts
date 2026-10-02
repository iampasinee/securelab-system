import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RegistrationPasswordStep } from '../components/auth/RegistrationPasswordStep';
import { advanceMockFaceScan, MockFaceScanStep } from '../components/auth/MockFaceScanStep';
import type { FaceEnrollmentStatus } from '../types/auth';
import {
  authenticateMockAccount,
  canEnterRegistrationStep,
  credentialsAfterAccountSelection,
  completeMockRegistration,
  initialMockAuthUsers,
  legacyMockPassword,
  migrateMockAuthUsers,
  parseStudentUniversityEmail,
  resolveMockAuthAccount,
  resolveUniversityAccount,
  validateRegistrationPassword,
} from './authState';
import { classGroupsForCohort, createInitialAcademicState } from './academicState';
import { calculateYearLevelFromAdmissionYear } from '../utils/academicYear';

test('university domains resolve student and staff without granting Admin from domain alone', () => {
  assert.equal(resolveUniversityAccount('s6701011500167@email.kmutnb.ac.th').domain, 'student');
  assert.equal(resolveUniversityAccount('teacher@itm.kmutnb.ac.th').domain, 'staff');
  assert.equal(resolveUniversityAccount('admin@itm.kmutnb.ac.th').domain, 'staff');
  assert.equal(resolveUniversityAccount('user@gmail.com').domain, 'unsupported');
});

test('student university email derives Student ID and canonical admission year', () => {
  assert.deepEqual(parseStudentUniversityEmail('s6701011500167@email.kmutnb.ac.th'), {
    studentId: '6701011500167',
    admissionYear: 2567,
  });
});

test('student university email parsing rejects missing prefix and non-digit local parts', () => {
  assert.equal(parseStudentUniversityEmail('6701011500167@email.kmutnb.ac.th'), null);
  assert.equal(parseStudentUniversityEmail('student@email.kmutnb.ac.th'), null);
  assert.equal(parseStudentUniversityEmail('sABC123@email.kmutnb.ac.th'), null);
  assert.match(resolveMockAuthAccount('student@email.kmutnb.ac.th', initialMockAuthUsers).error || '', /รูปแบบที่กำหนด/);
});

test('derived student year level continues to use central academic-year calculation', () => {
  const result = calculateYearLevelFromAdmissionYear(2567, 2569);
  assert.equal(result.yearLevel, 3);
  assert.equal(result.formattedYearLevel, 'ชั้นปีที่ 3');
});

test('Student registration cohort options use Major + admissionYear and active status', () => {
  const state = createInitialAcademicState();
  const groups = classGroupsForCohort(state, 'program_inet', 2567, true);
  assert.ok(groups.length > 0);
  assert.ok(groups.every((group) => group.majorId === 'program_inet' && group.admissionYear === 2567 && group.status === 'active'));
  const selectedGroupId = groups[0].id;
  assert.equal(classGroupsForCohort(state, 'program_ine', 2567, true).some((group) => group.id === selectedGroupId), false);
});

test('staff role comes from the predefined mock account record', () => {
  assert.equal(resolveMockAuthAccount('teacher@itm.kmutnb.ac.th', initialMockAuthUsers).user?.role, 'teacher');
  assert.equal(resolveMockAuthAccount('admin@itm.kmutnb.ac.th', initialMockAuthUsers).user?.role, 'admin');
});

test('unknown supported accounts do not acquire a role', () => {
  const result = resolveMockAuthAccount('unknown@itm.kmutnb.ac.th', initialMockAuthUsers);
  assert.equal(result.user, undefined);
  assert.match(result.error || '', /ไม่พบข้อมูลบัญชี/);
});

test('registration requires verified mock face enrollment', () => {
  const target = initialMockAuthUsers.find((user) => user.id === 'auth_student_new')!;
  const blocked = completeMockRegistration(initialMockAuthUsers, target.id, 'captured', 'Password123', 'Password123');
  assert.equal(blocked.success, false);
  assert.match(blocked.error || '', /ลงทะเบียนใบหน้า/);
  const completed = completeMockRegistration(initialMockAuthUsers, target.id, 'verified_mock', 'Password123', 'Password123');
  assert.equal(completed.success, true);
  assert.equal(completed.users.find((user) => user.id === target.id)?.registered, true);
});

test('Student and Teacher registration reject unfinished or legacy scan phases', () => {
  for (const role of ['student', 'teacher'] as const) {
    const account = initialMockAuthUsers.find((user) => user.role === role && !user.registered)!;
    for (const status of ['not_started', 'scanning', 'verifying'] as FaceEnrollmentStatus[]) {
      assert.equal(completeMockRegistration(initialMockAuthUsers, account.id, status, 'Password123', 'Password123').success, false);
    }
  }
});

test('face-scan mock uses only six tasks and gates Continue until verified', () => {
  const render = (status: FaceEnrollmentStatus) => renderToStaticMarkup(React.createElement(MockFaceScanStep, {
    status, onStatusChange: () => {}, onBack: () => {}, onContinue: () => {},
  }));
  const initial = render('not_started');
  for (const task of ['หน้าตรง', 'หลับตา-ลืมตา', 'หันซ้าย', 'หันขวา', 'เงยหน้า-ก้มหน้า', 'ใบหน้าเข้าใกล้']) {
    assert.match(initial, new RegExp(task));
  }
  assert.match(initial, /เริ่มสแกน/);
  assert.match(initial, /disabled=""[^>]*>ดำเนินการต่อ/);

  const scanning = render('scanning');
  assert.match(scanning, /ยกเลิกการสแกน/);
  assert.match(scanning, /disabled=""[^>]*>ดำเนินการต่อ/);
  const legacyVerifying = render('verifying');
  assert.match(legacyVerifying, /เริ่มสแกน/);
  assert.match(legacyVerifying, /disabled=""[^>]*>ดำเนินการต่อ/);

  const verified = render('verified_mock');
  assert.match(verified, /ลงทะเบียนใบหน้าแบบจำลองสำเร็จ/);
  assert.match(verified, /เริ่มใหม่/);
  assert.doesNotMatch(verified, /disabled=""[^>]*>ดำเนินการต่อ/);
  for (const markup of [initial, scanning, legacyVerifying, verified]) {
    assert.doesNotMatch(markup, /ตรวจสอบความต่อเนื่องของท่าทาง|role="progressbar"|ตรวจสอบความถูกต้องของข้อมูลใบหน้า/);
  }
});

test('face-scan sequence completes immediately after task six and can restart from zero', () => {
  let index = 0;
  for (let task = 1; task <= 6; task += 1) {
    const result = advanceMockFaceScan(index);
    assert.equal(result.index, task);
    assert.equal(result.complete, task === 6);
    index = result.index;
  }
  assert.deepEqual(advanceMockFaceScan(index), { index: 6, complete: true });
  assert.deepEqual(advanceMockFaceScan(0), { index: 1, complete: false });
});

test('unfinished persisted mock face status cannot turn a user into a registered account', () => {
  const seed = initialMockAuthUsers.find((user) => user.id === 'auth_student_new')!;
  const migrated = migrateMockAuthUsers([{ ...seed, registered: true, faceEnrollmentStatus: 'verifying' }]);
  const student = migrated.find((user) => user.id === seed.id)!;
  assert.equal(student.faceEnrollmentStatus, 'verifying');
  assert.equal(student.registered, false);
});

test('duplicate registration is rejected', () => {
  const result = completeMockRegistration(initialMockAuthUsers, 'auth_student_registered', 'verified_mock', 'Password123', 'Password123');
  assert.equal(result.success, false);
  assert.match(result.error || '', /ลงทะเบียนในระบบแล้ว/);
});

test('Student and Teacher cannot enter profile or later steps before a valid password', () => {
  for (const role of ['student', 'teacher'] as const) {
    const account = initialMockAuthUsers.find((user) => user.role === role && !user.registered)!;
    assert.equal(canEnterRegistrationStep(2, account, '', ''), true);
    assert.equal(canEnterRegistrationStep(3, account, '', ''), false);
    assert.equal(canEnterRegistrationStep(5, account, 'Password123', 'mismatch'), false);
    assert.equal(canEnterRegistrationStep(3, account, 'Password123', 'Password123'), true);
  }
});

test('switching Google account clears credential draft but revisiting the same account preserves it', () => {
  const current = { password: 'Password123', confirmation: 'Password123' };
  assert.deepEqual(credentialsAfterAccountSelection('teacher@itm.kmutnb.ac.th', 's6701011500167@email.kmutnb.ac.th', current), { password: '', confirmation: '' });
  assert.deepEqual(credentialsAfterAccountSelection('teacher@itm.kmutnb.ac.th', 'TEACHER@ITM.KMUTNB.AC.TH', current), current);
});

test('password requirements reject short, letterless, numberless, mismatched and outer whitespace values', () => {
  assert.equal(validateRegistrationPassword('Abc123', 'Abc123').valid, false);
  assert.equal(validateRegistrationPassword('12345678', '12345678').hasLetter, false);
  assert.equal(validateRegistrationPassword('abcdefgh', 'abcdefgh').hasNumber, false);
  assert.equal(validateRegistrationPassword('Password123', 'Password321').matches, false);
  assert.equal(validateRegistrationPassword(' Password123', ' Password123').noOuterWhitespace, false);
  assert.equal(validateRegistrationPassword('Password123 ', 'Password123 ').noOuterWhitespace, false);
  assert.equal(validateRegistrationPassword('Password123', 'Password123').valid, true);
});

test('shared Password step keeps selected email read-only and masks both password fields by default', () => {
  const markup = renderToStaticMarkup(React.createElement(RegistrationPasswordStep, {
    email: 'teacher@itm.kmutnb.ac.th',
    password: '', confirmation: '',
    onPasswordChange: () => {}, onConfirmationChange: () => {}, onBack: () => {}, onContinue: () => {},
  }));
  assert.match(markup, /teacher@itm\.kmutnb\.ac\.th/);
  assert.match(markup, /id="registration-account-email"[^>]*readOnly/);
  assert.match(markup, /id="registration-password" type="password"/);
  assert.match(markup, /id="registration-confirm-password" type="password"/);
  assert.match(markup, /aria-label="แสดงรหัสผ่าน"/);
  assert.match(markup, /disabled=""/);
});

test('new Student and Teacher mock credentials authenticate and wrong passwords fail', () => {
  for (const role of ['student', 'teacher'] as const) {
    const account = initialMockAuthUsers.find((user) => user.role === role && !user.registered)!;
    const completed = completeMockRegistration(initialMockAuthUsers, account.id, 'verified_mock', 'Password123', 'Password123');
    assert.equal(completed.success, true);
    assert.equal(authenticateMockAccount(account.email, 'Password123', completed.users).user?.id, account.id);
    const restored = migrateMockAuthUsers(completed.users);
    assert.equal(authenticateMockAccount(account.email, 'Password123', restored).user?.id, account.id);
    assert.equal(authenticateMockAccount(account.email, 'incorrect', restored).user, undefined);
    assert.equal(authenticateMockAccount(account.email, 'incorrect', restored).error, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    assert.equal(authenticateMockAccount('unknown@itm.kmutnb.ac.th', 'Password123', completed.users).user, undefined);
    assert.equal('password' in account, false);
  }
});

test('Admin self-registration is blocked and staff domain does not grant Admin rights', () => {
  const admin = initialMockAuthUsers.find((user) => user.role === 'admin')!;
  assert.equal(canEnterRegistrationStep(2, admin, '', ''), false);
  assert.equal(completeMockRegistration(initialMockAuthUsers, admin.id, 'verified_mock', 'Password123', 'Password123').success, false);
  assert.equal(resolveMockAuthAccount('teacher@itm.kmutnb.ac.th', initialMockAuthUsers).user?.role, 'teacher');
});

test('registered legacy accounts receive a demo password and retain roles and associations', () => {
  const migrated = migrateMockAuthUsers([{ ...initialMockAuthUsers[1], mockPassword: undefined }]);
  assert.equal(migrated[1].role, 'student');
  assert.equal(migrated[1].subjectId, initialMockAuthUsers[1].subjectId);
  assert.equal(migrated[1].mockPassword, legacyMockPassword);
  assert.equal(authenticateMockAccount(migrated[1].email, legacyMockPassword, migrated).user?.id, migrated[1].id);
});

test('persisted state may update registration only, not email, role or subject identity', () => {
  const migrated = migrateMockAuthUsers([{
    ...initialMockAuthUsers[0],
    role: 'admin',
    subjectId: 'adm_0001',
    registered: true,
    faceEnrollmentStatus: 'verified_mock',
  }]);
  assert.equal(migrated[0].role, 'student');
  assert.equal(migrated[0].subjectId, 'std_0001');
  assert.equal(migrated[0].registered, true);
});

test('persisted registration cannot be complete without verified mock face enrollment', () => {
  const migrated = migrateMockAuthUsers([{
    ...initialMockAuthUsers[0],
    registered: true,
    faceEnrollmentStatus: 'captured',
  }]);
  assert.equal(migrated[0].registered, false);
  assert.equal(migrated[0].faceEnrollmentStatus, 'captured');
});

test('legacy student mock email migrates to the new prefixed format without losing registration', () => {
  const migrated = migrateMockAuthUsers([{
    ...initialMockAuthUsers[0],
    email: '6410123456@email.kmutnb.ac.th',
    registered: true,
    faceEnrollmentStatus: 'verified_mock',
  }]);
  assert.equal(migrated[0].email, 's6701011500167@email.kmutnb.ac.th');
  assert.equal(migrated[0].registered, true);
});
