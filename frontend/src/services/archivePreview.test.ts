import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { ArchivePreviewTree } from '../components/student/ArchivePreview';
import type { StagedUploadRecord } from '../types/stagedUpload';
import {
  inspectZipStructure,
  normalizeZipEntryPath,
  ZIP_PREVIEW_LIMITS,
  ZIP_PREVIEW_UNAVAILABLE_MESSAGE,
  ZIP_PREVIEW_UNSAFE_MESSAGE,
} from './archivePreview';
import { getFilePreviewType } from './filePreview';
import { getStudentAttemptStagingKey } from './studentDemoRetry';

const sessionKey = getStudentAttemptStagingKey('exam-1', 'student-a', 'attempt-1');

const makeRecord = (blob: Blob, name = 'project.zip', key = sessionKey): StagedUploadRecord => ({
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
});

const makeZip = async (entries: Array<[string, string]>): Promise<Blob> => {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (const [name, content] of entries) await writer.add(name, new TextReader(content));
  return writer.close();
};

test('ZIP structure lists nested paths and counts files/folders without reading inner code', async () => {
  const unsafeSource = '<script>globalThis.__archiveExecuted = true</script>';
  const record = makeRecord(await makeZip([
    ['src/main.py', unsafeSource], ['src/utils.py', 'print(1)'],
    ['web/index.html', unsafeSource], ['scripts/test.js', unsafeSource],
    ['images/diagram.png', 'not decoded'], ['README.md', 'hello'],
  ]));
  const originalBlob = record.blob;
  const result = await inspectZipStructure(record);
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.equal(result.fileCount, 6);
  assert.equal(result.folderCount, 4);
  assert.equal(result.entryCount, 6);
  assert.equal(result.tree.find((node) => node.name === 'src')?.children.map((node) => node.name).join(','), 'main.py,utils.py');
  assert.equal(result.tree.find((node) => node.name === 'web')?.children[0].path, 'web/index.html');
  const markup = renderToStaticMarkup(React.createElement(ArchivePreviewTree, { nodes: result.tree, visibleLimit: 200 }));
  assert.match(markup, /main\.py/);
  assert.match(markup, /index\.html/);
  assert.match(markup, /test\.js/);
  assert.ok(!markup.includes('<button'));
  assert.ok(!markup.includes('<iframe'));
  assert.ok(!markup.includes('<script'));
  assert.ok(result.totalUncompressedBytes > 0);
  assert.equal(record.blob, originalBlob);
  assert.equal((globalThis as typeof globalThis & { __archiveExecuted?: boolean }).__archiveExecuted, undefined);
  assert.equal(getFilePreviewType(record), 'archive');
  assert.equal(record.status, 'ready'); // Preview support never changes submission validity.
});

test('suspicious ZIP paths are display-only and cannot escape a filesystem', async () => {
  for (const path of ['../../unsafe.txt', '/absolute/path.txt', 'C:/system/file.txt']) {
    const record = makeRecord(await makeZip([[path, 'unsafe'], ['src/safe.py', 'safe']]));
    const result = await inspectZipStructure(record);
    // The ZIP library may reject hostile paths before our display-only path guard sees them.
    assert.ok(result.status === 'ready' || result.status === 'unavailable', path);
    if (result.status === 'ready') {
      assert.deepEqual(result.suspiciousPaths, [path]);
      assert.deepEqual(result.tree.map((node) => node.name), ['src']);
    }
  }
  assert.deepEqual(normalizeZipEntryPath('..\\..\\system\\file.txt'), {
    segments: ['..', '..', 'system', 'file.txt'], suspicious: true,
  });
  assert.equal(normalizeZipEntryPath('src/main.py').suspicious, false);
});

test('malformed and encrypted ZIPs fall back safely to metadata', async () => {
  const malformed = await inspectZipStructure(makeRecord(new Blob(['not a ZIP'], { type: 'application/zip' })));
  assert.deepEqual(malformed, { status: 'unavailable', message: ZIP_PREVIEW_UNAVAILABLE_MESSAGE });

  const zip = new Uint8Array(await (await makeZip([['safe.txt', 'hello']])).arrayBuffer());
  const view = new DataView(zip.buffer);
  for (let index = 0; index < zip.length - 4; index += 1) {
    if (view.getUint32(index, true) === 0x02014b50) {
      view.setUint16(index + 8, view.getUint16(index + 8, true) | 1, true);
      break;
    }
  }
  const encrypted = await inspectZipStructure(makeRecord(new Blob([zip], { type: 'application/zip' })));
  assert.deepEqual(encrypted, { status: 'unavailable', message: ZIP_PREVIEW_UNAVAILABLE_MESSAGE });
});

test('too many ZIP entries and oversized archive metadata trigger safe fallback', async () => {
  const names = Array.from({ length: ZIP_PREVIEW_LIMITS.maxEntries + 1 }, (_, index) =>
    [`files/${index}.txt`, ''] as [string, string]);
  const many = await inspectZipStructure(makeRecord(await makeZip(names)));
  assert.deepEqual(many, { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE });

  const zip = new Uint8Array(await (await makeZip([['small.txt', 'hello']])).arrayBuffer());
  const view = new DataView(zip.buffer);
  for (let index = 0; index < zip.length - 4; index += 1) {
    if (view.getUint32(index, true) === 0x02014b50) {
      view.setUint32(index + 24, ZIP_PREVIEW_LIMITS.maxReportedUncompressedBytes + 1, true);
      break;
    }
  }
  const bomb = await inspectZipStructure(makeRecord(new Blob([zip], { type: 'application/zip' })));
  assert.deepEqual(bomb, { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE });

  view.setUint32(zip.findIndex((_, index) => index + 4 < zip.length && view.getUint32(index, true) === 0x02014b50) + 24,
    10 * 1024 * 1024, true);
  const extremeRatio = await inspectZipStructure(makeRecord(new Blob([zip], { type: 'application/zip' })));
  assert.deepEqual(extremeRatio, { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE });
});

test('unsupported RAR and 7Z remain metadata only and attempt lookup stays isolated', async () => {
  const blob = await makeZip([['src/main.py', 'print(1)']]);
  assert.equal(getFilePreviewType(makeRecord(blob, 'project.rar')), 'metadata');
  assert.equal(getFilePreviewType(makeRecord(blob, 'project.7z')), 'metadata');
  assert.deepEqual(await inspectZipStructure(makeRecord(blob, 'project.rar')),
    { status: 'unavailable', message: ZIP_PREVIEW_UNAVAILABLE_MESSAGE });
  const oldAttempt = makeRecord(blob, 'old.zip', getStudentAttemptStagingKey('exam-1', 'student-a', 'attempt-0'));
  const current = makeRecord(blob);
  assert.notEqual(oldAttempt.sessionKey, current.sessionKey);
});
