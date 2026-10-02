import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course, ExamSession, Room, Student, Teacher } from '../../types';
import type { AcademicState } from '../../types/academic';
import { defaultExamPolicy } from '../../services/examWizard';
import { resolveAuthorizedExamDetail } from '../../services/teacherExamDetail';
import { ExamDetailPage } from './ExamDetailPage';

const teacherCourses = [{
  id: 'course-1', courseCode: 'CS301', courseName: 'โครงสร้างข้อมูล',
  sections: [{
    sectionNo: '1', primaryTeacherId: 'teacher-1', coTeacherIds: ['teacher-2'],
    semester: 1, academicYear: 2569,
    cohorts: [{ majorId: 'major-1', admissionYear: 2567, classGroupIds: ['group-ra'] }],
    includedStudentIds: [], excludedStudentIds: [],
  }],
}] as Course[];
const academicState = {
  majors: [{ id: 'major-1', code: 'INET-DE' }],
  classGroups: [{ id: 'group-ra', code: 'INET-DE-RA' }],
} as AcademicState;
const students = [{ id: 'student-1', majorId: 'major-1', admissionYear: 2567, classGroupId: 'group-ra' }] as Student[];
const teachers = [{ id: 'teacher-1', fullName: 'อาจารย์หลัก' }, { id: 'teacher-2', fullName: 'อาจารย์ร่วม' }] as Teacher[];
const rooms = [{ id: 'room-1', labName: 'B4-08', floor: 4, seats: [{ machineNo: 'PC-1' }] }] as Room[];
const policy = defaultExamPolicy();
policy.online.allowedDomains = ['docs.python.org'];
policy.online.blockedResources = [{ id: 'custom', name: 'เว็บไซต์ตัวอย่าง', type: 'website', value: 'example.org' }];
const exam = {
  id: 'exam-1', courseId: 'course-1', sectionNo: '1', examName: 'สอบปลายภาค', examType: 'final',
  examDate: '2026-09-25', startTime: '09:00', endTime: '12:00', durationMinutes: 180,
  roomId: 'room-1', format: 'online', status: 'upcoming',
  fileRequirements: { acceptedExtensions: ['.zip', '.py'], maxSizeMb: 25, filenamePattern: '{studentCode}_final', requiredFileCount: 1, instructions: 'ตรวจสอบไฟล์' },
  rules: [{ id: 'rule-1', text: 'ห้ามสื่อสารระหว่างสอบ' }], policy,
} as ExamSession;

const renderDetail = (session: ExamSession, now = new Date(2026, 8, 24, 10, 0)) => {
  const detail = resolveAuthorizedExamDetail(session.id, [session], teacherCourses, 'teacher-1');
  assert.ok(detail);
  return renderToStaticMarkup(<ExamDetailPage
    detail={detail} academicState={academicState} rooms={rooms} students={students}
    teachers={teachers} now={now} onBack={() => {}} onEdit={() => {}}
  />);
};

test('detail resolves by stable ID and blocks unrelated Teacher or Section', () => {
  assert.equal(resolveAuthorizedExamDetail('exam-1', [exam], teacherCourses, 'teacher-1')?.exam.id, 'exam-1');
  assert.equal(resolveAuthorizedExamDetail('exam-1', [exam], teacherCourses, 'teacher-2')?.exam.id, 'exam-1');
  assert.equal(resolveAuthorizedExamDetail('exam-1', [exam], teacherCourses, 'teacher-other'), undefined);
  assert.equal(resolveAuthorizedExamDetail('exam-other', [exam], teacherCourses, 'teacher-1'), undefined);
  assert.equal(resolveAuthorizedExamDetail('exam-1', [exam], [], 'teacher-1'), undefined);
});

test('online detail shows saved course, roster, schedule, room, file, identity and custom resources', () => {
  const html = renderDetail(exam);
  for (const text of ['CS301', 'Section 1', 'อาจารย์หลัก', 'อาจารย์ร่วม', 'INET-DE-RA', 'ปีที่เข้าศึกษา 67', '25 กันยายน 2569', '09:00', '12:00', '180 นาที', 'B4-08', '25 MB', '.zip, .py', 'บังคับใช้เครื่องที่ลงทะเบียน', 'เปิดใช้งาน', 'เว็บไซต์ตัวอย่าง', 'example.org', 'docs.python.org', 'นโยบายออนไลน์', 'แก้ไขการสอบ', 'ย้อนกลับ']) {
    assert.ok(html.includes(text), `Missing ${text}`);
  }
  assert.ok(!html.includes('นโยบายออฟไลน์'));
  assert.ok(!html.includes('>true<'));
  assert.ok(!html.includes('>false<'));
});

test('offline detail hides online-only policy while retaining shared resources and file policy', () => {
  const html = renderDetail({ ...exam, format: 'offline' });
  assert.ok(html.includes('นโยบายออฟไลน์'));
  assert.ok(html.includes('exam.local'));
  assert.ok(html.includes('เว็บไซต์ตัวอย่าง'));
  assert.ok(html.includes('บังคับ Device Signature'));
  assert.ok(!html.includes('นโยบายออนไลน์'));
  assert.ok(!html.includes('เว็บไซต์ที่อนุญาต'));
});

test('detail labels allowed and blocked resources by mode without reinterpreting historical blocked entries', () => {
  const allowedPolicy = structuredClone(policy);
  allowedPolicy.online.allowedResources = [{ id: 'allowed-1', name: 'เอกสาร Python', type: 'website', value: 'docs.python.org' }];
  const allowedHtml = renderDetail({ ...exam, policy: allowedPolicy });
  assert.ok(allowedHtml.includes('ทรัพยากรที่อนุญาต'));
  assert.ok(allowedHtml.includes('เอกสาร Python'));
  assert.ok(allowedHtml.includes('รายการบล็อกเดิมที่ยังคงอยู่'));
  assert.ok(allowedHtml.includes('เว็บไซต์ตัวอย่าง (example.org)'));

  const blockedPolicy = structuredClone(allowedPolicy);
  blockedPolicy.online.resourceMode = 'blocklist';
  const blockedHtml = renderDetail({ ...exam, policy: blockedPolicy });
  assert.ok(blockedHtml.includes('ทรัพยากรที่บล็อก'));
  assert.ok(blockedHtml.includes('Blocklist'));
  assert.ok(!blockedHtml.includes('รายการบล็อกเดิมที่ยังคงอยู่'));
});

test('optional legacy policy shows missing values rather than invented defaults', () => {
  const html = renderDetail({ ...exam, policy: undefined });
  assert.ok(html.includes('ไม่ได้กำหนด'));
  assert.ok(!html.includes('docs.python.org'));
});

test('effective status hides edit after exam starts, regardless of stale stored status', () => {
  const html = renderDetail(exam, new Date(2026, 8, 25, 10, 0));
  assert.ok(html.includes('กำลังสอบ'));
  assert.ok(!html.includes('แก้ไขการสอบ'));
});
