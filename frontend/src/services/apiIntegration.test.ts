import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient } from './apiClient';
import { assignmentFromApi, bangkokDateTime, examFromApi, examWritePayload, roomFromApi, violationFromApi } from './apiAdapters';
import { defaultExamPolicy } from './examWizard';
import { getExamRoomComputerCount } from './examWizard';
import { getEffectiveExamStatus } from './examStatus';
import { getBangkokDateInputValue } from './serverClock';
import type { ApiExam, ApiRoom, ApiViolation } from '../types/api';

test('API UTC schedule uses Bangkok display and the exclusive end instant', () => {
  const policy = defaultExamPolicy();
  const dto = { id: 'exam-id', sectionId: 'section-year-2569-semester-2', sectionNumber: 1, startsAt: '2026-10-02T02:00:00Z', endsAt: '2026-10-02T04:00:00Z',
    serverNow: '2026-10-02T02:30:00Z', maxFileSizeBytes: 1048576, requiredFileCount: 1, acceptedExtensions: ['.py'], rules: [], policy, status: 'in_progress', mode: 'online' } as ApiExam;
  assert.deepEqual(bangkokDateTime(dto.startsAt), { date: '2026-10-02', time: '09:00' });
  const exam = examFromApi(dto);
  assert.equal(exam.sectionId, dto.sectionId);
  assert.equal(getEffectiveExamStatus(exam, new Date(dto.endsAt)), 'completed');
  assert.equal(getEffectiveExamStatus(exam, new Date('2026-10-02T03:59:59.999Z')), 'in_progress');
  assert.throws(() => examWritePayload({ ...exam, sectionId: undefined }), /ID/);
  assert.equal(examWritePayload(exam).startsAt, '2026-10-02T02:00:00.000Z');
});

test('monitoring dates use Bangkok across the UTC midnight boundary', () => {
  assert.equal(getBangkokDateInputValue(new Date('2026-10-01T17:00:00Z')), '2026-10-02');
  assert.equal(getBangkokDateInputValue(new Date('2026-10-01T16:59:59Z')), '2026-10-01');
});

test('allow and block resources survive the API adapter independently', () => {
  const policy = defaultExamPolicy();
  policy.online.allowedResources = [{ id: 'a', type: 'website', name: 'เอกสาร', value: 'docs.python.org' }];
  policy.online.blockedResources = [{ id: 'b', type: 'website', name: 'สื่อสาร', value: 'chat.example' }];
  const exam = examFromApi({ sectionId: 'section-uuid', startsAt: '2026-10-02T02:00:00Z', endsAt: '2026-10-02T04:00:00Z', maxFileSizeBytes: 1048576, rules: [], policy } as ApiExam);
  const written = examWritePayload(exam);
  assert.equal(written.policy!.online.allowedResources[0].value, 'docs.python.org');
  assert.equal(written.policy!.online.blockedResources[0].value, 'chat.example');
  assert(!('id' in written.policy!.online.blockedResources[0]));
});

test('room readiness never fabricates an online machine or a seat assignment', () => {
  const room = roomFromApi({ id: 'room', status: 'ready', isAssignable: true, capacity: 50, computerCount: 45, floorNumber: 4, roomCode: 'B4-08', seats: [] } as ApiRoom);
  assert.equal(room.capacity, 50);
  assert.equal(getExamRoomComputerCount(room), 45);
  assert.deepEqual(room.seats, []);
  const assignment = assignmentFromApi({ examId: 'exam', studentId: 'student', seatId: 'seat-uuid', deviceId: 'device-uuid', seatCode: 'R2C3' } as any, room);
  assert.equal(assignment.seatId, 'seat-uuid');
  assert.equal(assignment.seatNo, 'R2C3');
});

test('student seen and staff review remain independent in UI projections', () => {
  const event = { id: 'incident', studentSeenAt: '2026-10-02T02:00:00Z', reviewedAt: null, acknowledged: false, source: 'development_simulation' } as ApiViolation;
  const projected = violationFromApi(event, []);
  assert.equal(projected.studentSeenAt, event.studentSeenAt);
  assert.equal(projected.reviewedAt, undefined);
  assert.equal(projected.acknowledged, false);
  assert.equal(projected.seatNo, '—');
});

test('API transport coalesces refresh and never persists a credential in browser storage', async () => {
  const original = globalThis.fetch;
  let refreshes = 0;
  const client = new ApiClient();
  globalThis.fetch = (async (input, options) => {
    if (String(input).endsWith('/auth/refresh')) {
      refreshes += 1;
      assert.equal(options!.credentials, 'include');
      assert.equal((options!.headers as Record<string, string>)['X-SecureLab-CSRF'], '1');
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json({ accessToken: 'opaque-test-access', expiresIn: 900 });
    }
    assert.equal((options!.headers as Record<string, string>).Authorization, 'Bearer opaque-test-access');
    return Response.json({ id: 'authorized' });
  }) as typeof fetch;
  try {
    const values = await Promise.all([client.request('/auth/me'), client.request('/auth/me')]);
    assert.equal(refreshes, 1); assert.deepEqual(values, [{ id: 'authorized' }, { id: 'authorized' }]);
  } finally { globalThis.fetch = original; }
});

test('lost response keeps the same idempotency key; payload changes get a different key', async () => {
  const original = globalThis.fetch;
  const client = new ApiClient(); const keys: string[] = []; let lost = true;
  globalThis.fetch = (async (input, options) => {
    if (String(input).endsWith('/auth/refresh')) return Response.json({ accessToken: 'test', expiresIn: 900 });
    keys.push((options!.headers as Record<string, string>)['Idempotency-Key']);
    if (lost) { lost = false; throw new TypeError('network failure'); }
    return Response.json({ saved: true });
  }) as typeof fetch;
  try {
    await assert.rejects(client.request('/exams', { method: 'POST', idempotent: true, body: { name: 'same' } }));
    await client.request('/exams', { method: 'POST', idempotent: true, body: { name: 'same' } });
    await client.request('/exams', { method: 'POST', idempotent: true, body: { name: 'other' } });
    assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2]);
  } finally { globalThis.fetch = original; }
});

test('expired access is retried once after refresh and validation stays Thai', async () => {
  const original = globalThis.fetch; const client = new ApiClient(); let calls = 0; let refreshes = 0;
  globalThis.fetch = (async (input) => {
    if (String(input).endsWith('/auth/refresh')) { refreshes += 1; return Response.json({ accessToken: 'test', expiresIn: 900 }); }
    calls += 1;
    return calls === 1 ? Response.json({ detail: { code: 'unauthenticated' } }, { status: 401 }) : Response.json({ detail: [{ loc: ['body', 'password'], msg: 'English validation' }] }, { status: 422 });
  }) as typeof fetch;
  try {
    await assert.rejects(client.request('/test'), (error: Error) => /ข้อมูลบางช่อง/.test(error.message) && !error.message.includes('password'));
    assert.equal(refreshes, 2); assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
