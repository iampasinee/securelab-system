import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilePreviewModal, FilePreviewText } from '../components/student/FilePreviewModal';
import type { StagedUploadRecord } from '../types/stagedUpload';
import { formatFileSize } from '../utils/fileSize';
import { getStudentAttemptStagingKey } from './studentDemoRetry';
import {
  findCurrentAttemptPreviewFile,
  getFilePreviewMetadata,
  getFilePreviewType,
  MAX_TEXT_PREVIEW_BYTES,
  readTextPreview,
} from './filePreview';

const sessionKey = getStudentAttemptStagingKey('exam-1', 'student-a', 'attempt-1');
const makeRecord = (name: string, mimeType: string, content: BlobPart = 'answer', key = sessionKey): StagedUploadRecord => {
  const blob = new Blob([content], { type: mimeType });
  return {
    uploadId: name,
    uploadSequence: 1,
    sessionKey: key,
    originalName: name,
    submissionName: name,
    sizeBytes: blob.size,
    extension: name.slice(name.lastIndexOf('.')).toLowerCase(),
    lastUpdated: '2026-10-01T00:00:00.000Z',
    progress: 100,
    status: 'ready',
    blob,
  };
};

test('source, JavaScript and shell extensions use read-only text preview', async () => {
  for (const name of ['answer.py', 'notes.txt', 'main.js', 'main.tsx', 'config.yaml', 'run.sh', 'run.ps1']) {
    const record = makeRecord(name, 'text/plain', 'print("hello")\n');
    assert.equal(getFilePreviewType(record), 'text');
    assert.equal(await readTextPreview(record), 'print("hello")\n');
  }
});

test('HTML source is escaped by the viewer rather than rendered as active markup', async () => {
  const html = '<img src=x onerror=alert(1)><script>window.__secureLabUnsafeExecution = true</script>';
  const record = makeRecord('answer.html', 'text/html', html);
  assert.equal(getFilePreviewType(record), 'text');
  const source = await readTextPreview(record);
  assert.equal(source, html);
  const markup = renderToStaticMarkup(<FilePreviewText content={source!} />);
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(!markup.includes('<script>'));
  assert.ok(!markup.includes('<img src=x'));
  assert.ok(markup.includes('aria-label="เนื้อหาไฟล์แบบอ่านอย่างเดียว"'));
  assert.equal((globalThis as typeof globalThis & { __secureLabUnsafeExecution?: boolean }).__secureLabUnsafeExecution, undefined);
});

test('JavaScript source is shown literally and has no active script element', async () => {
  const source = 'window.__secureLabUnsafeExecution = true;';
  const record = makeRecord('answer.js', 'text/javascript', source);
  assert.equal(await readTextPreview(record), source);
  const markup = renderToStaticMarkup(<FilePreviewText content={source} />);
  assert.match(markup, /<pre[^>]*><code>window\.__secureLabUnsafeExecution = true;<\/code><\/pre>/);
  assert.ok(!markup.includes('<script'));
  assert.equal((globalThis as typeof globalThis & { __secureLabUnsafeExecution?: boolean }).__secureLabUnsafeExecution, undefined);
});

test('PNG, JPG, JPEG, WebP and GIF use image preview when MIME matches', () => {
  for (const [name, mime] of [
    ['diagram.png', 'image/png'], ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'], ['screen.webp', 'image/webp'], ['motion.gif', 'image/gif'],
  ]) {
    assert.equal(getFilePreviewType(makeRecord(name, mime)), 'image');
  }
  assert.equal(getFilePreviewType(makeRecord('spoof.png', 'image/svg+xml')), 'metadata');
  assert.equal(getFilePreviewType(makeRecord('unknown.png', '')), 'metadata');
});

test('ZIP uses structure-only preview while unsupported binaries and SVG use metadata', async () => {
  assert.equal(getFilePreviewType(makeRecord('project.zip', 'application/zip')), 'archive');
  assert.equal(getFilePreviewType(makeRecord('project.zip', 'application/octet-stream')), 'archive');
  assert.equal(getFilePreviewType(makeRecord('spoof.zip', 'text/html')), 'metadata');
  for (const [name, mime] of [
    ['project.rar', 'application/octet-stream'], ['project.7z', 'application/octet-stream'],
    ['document.docx', 'application/octet-stream'], ['binary.bin', 'application/octet-stream'],
    ['vector.svg', 'image/svg+xml'], ['program.exe', 'application/octet-stream'],
  ]) {
    const record = makeRecord(name, mime);
    assert.equal(getFilePreviewType(record), 'metadata');
    assert.equal(await readTextPreview(record), null);
  }
  assert.equal(getFilePreviewType(makeRecord('disguised.txt', 'image/svg+xml')), 'metadata');
  assert.equal(getFilePreviewType(makeRecord('mystery.unknown', 'text/plain')), 'metadata');
  const svg = makeRecord('vector.svg', 'image/svg+xml', '<svg onload="window.__secureLabUnsafeExecution = true" />');
  const markup = renderToStaticMarkup(<FilePreviewModal record={svg} onClose={() => {}} />);
  assert.ok(!markup.includes('__secureLabUnsafeExecution'));
});

test('oversized text is never decoded for preview', async () => {
  const record = makeRecord('large.txt', 'text/plain', new Uint8Array(MAX_TEXT_PREVIEW_BYTES + 1));
  assert.equal(getFilePreviewType(record), 'text');
  assert.equal(await readTextPreview(record), null);
  assert.match(renderToStaticMarkup(<FilePreviewModal record={record} onClose={() => {}} />), /ไฟล์มีขนาดใหญ่เกินกว่าจะแสดงตัวอย่าง/);
});

test('unsupported archives show metadata and cannot be opened as active content', () => {
  const record = makeRecord('project.rar', 'application/octet-stream');
  const markup = renderToStaticMarkup(<FilePreviewModal record={record} onClose={() => {}} />);
  assert.match(markup, /ไม่สามารถแสดงตัวอย่างใน SecureLab/);
  assert.match(markup, /application\/octet-stream/);
  assert.ok(!markup.includes('<iframe'));
});

test('preview dialog is inspection-only and exposes no edit or execute control', () => {
  const record = makeRecord('answer.py', 'text/x-python');
  const markup = renderToStaticMarkup(<FilePreviewModal record={record} onClose={() => {}} />);
  assert.match(markup, /ไม่สามารถแก้ไขหรือเรียกใช้ไฟล์จาก SecureLab ได้/);
  assert.ok(!markup.includes('<textarea'));
  assert.ok(!markup.includes('contenteditable'));
  assert.ok(!markup.includes('<iframe'));
  assert.ok(!markup.includes('<script'));
  assert.match(markup, />ปิด<\/button>/);
});

test('preview reads the original blob without changing file content or identity', async () => {
  const record = makeRecord('answer.py', 'text/x-python', 'print(42)');
  const originalBlob = record.blob;
  const originalRecord = { ...record };
  assert.equal(await readTextPreview(record), 'print(42)');
  assert.equal(await record.blob.text(), 'print(42)');
  assert.equal(record.blob, originalBlob);
  assert.deepEqual(record, originalRecord);
});

test('preview lookup accepts only the current student, exam and attempt', () => {
  const current = makeRecord('answer.py', 'text/plain');
  const oldAttempt = makeRecord('old.py', 'text/plain', 'old', getStudentAttemptStagingKey('exam-1', 'student-a', 'attempt-0'));
  const otherStudent = makeRecord('other.py', 'text/plain', 'other', getStudentAttemptStagingKey('exam-1', 'student-b', 'attempt-1'));
  const otherExam = makeRecord('another.py', 'text/plain', 'other', getStudentAttemptStagingKey('exam-2', 'student-a', 'attempt-1'));
  const all = [oldAttempt, otherStudent, otherExam, current];
  assert.equal(findCurrentAttemptPreviewFile(all, sessionKey, current.uploadId), current);
  assert.equal(findCurrentAttemptPreviewFile(all, sessionKey, oldAttempt.uploadId), undefined);
  assert.equal(findCurrentAttemptPreviewFile(all, sessionKey, otherStudent.uploadId), undefined);
  assert.equal(findCurrentAttemptPreviewFile(all, sessionKey, otherExam.uploadId), undefined);
});

test('metadata uses one formatter for file size, extension and MIME type', () => {
  const record = makeRecord('project.zip', 'application/zip', new Uint8Array(2 * 1024 * 1024));
  assert.deepEqual(getFilePreviewMetadata(record), {
    filename: 'project.zip', originalName: 'project.zip', extension: 'ZIP',
    mimeType: 'application/zip', size: '2.00 MB',
  });
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(12 * 1024), '12.00 KB');
});
