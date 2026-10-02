import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StagedUploadRecord } from '../../types/stagedUpload';
import { PreparedFileRow } from './PreparedFileRow';

const makeRecord = (status: StagedUploadRecord['status'] = 'ready'): StagedUploadRecord => ({
  uploadId: 'upload-1',
  uploadSequence: 1,
  sessionKey: 'student-a:exam-1:attempt-1',
  originalName: 'agent.py',
  submissionName: '6410123456_somchai_jaidee_1.py',
  sizeBytes: 6810,
  extension: '.py',
  lastUpdated: '2026-10-01T04:52:21.000Z',
  progress: status === 'uploading' ? 40 : 100,
  status,
  blob: new Blob(['print(1)'], { type: 'text/x-python' }),
});

const renderRow = (record: StagedUploadRecord, canManage = true) => renderToStaticMarkup(
  <PreparedFileRow
    file={record}
    canManage={canManage}
    statusLabel={record.status === 'ready' ? 'พร้อมส่ง' : 'กำลังอัปโหลด'}
    statusClass="text-emerald-700"
    onPreview={() => {}}
    onRename={() => {}}
    onRequestDelete={() => {}}
  />,
);

test('prepared row shows explicit file metadata and compact ready status', () => {
  const markup = renderRow(makeRecord());
  for (const label of ['ชื่อไฟล์สำหรับส่ง', 'ชื่อไฟล์ต้นฉบับ:', 'ขนาดไฟล์:', 'ประเภทไฟล์:', 'อัปโหลดเมื่อ:', 'พร้อมส่ง']) {
    assert.ok(markup.includes(label), `missing ${label}`);
  }
  assert.ok(markup.includes('6410123456_somchai_jaidee_1.py'));
  assert.ok(markup.includes('agent.py'));
  assert.ok(markup.includes('6.65 KB'));
  assert.ok(!markup.includes('role="progressbar"'));
});

test('preview, rename and delete remain visible keyboard-accessible actions', () => {
  const markup = renderRow(makeRecord());
  for (const label of ['ดูตัวอย่าง', 'เปลี่ยนชื่อ', 'ลบไฟล์']) {
    assert.ok(markup.includes(`aria-label="${label}"`));
    assert.ok(markup.includes(`title="${label}"`));
  }
  assert.ok(!markup.includes('disabled=""'));
  const locked = renderRow(makeRecord(), false);
  assert.equal((locked.match(/disabled=""/g) || []).length, 2);
});

test('upload progress is shown only while uploading and ZIP action opens structure preview', () => {
  assert.ok(renderRow(makeRecord('uploading')).includes('role="progressbar"'));
  const archive = { ...makeRecord(), originalName: 'project.zip', submissionName: 'project.zip', extension: '.zip', blob: new Blob(['PK'], { type: 'application/zip' }) };
  assert.ok(renderRow(archive).includes('aria-label="ดูโครงสร้าง ZIP"'));
});
