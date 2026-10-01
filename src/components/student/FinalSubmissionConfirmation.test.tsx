import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StagedUploadRecord } from '../../types/stagedUpload';
import { FinalSubmissionConfirmation } from './FinalSubmissionConfirmation';

const makeFile = (uploadId: string, sizeBytes: number): StagedUploadRecord => ({
  uploadId,
  uploadSequence: Number(uploadId),
  sessionKey: 'student:exam:attempt',
  originalName: `${uploadId}.py`,
  submissionName: `6410123456_somchai_jaidee_${uploadId}.py`,
  sizeBytes,
  extension: '.py',
  lastUpdated: '2026-10-01T00:00:00.000Z',
  progress: 100,
  status: 'ready',
  blob: new Blob(['answer'], { type: 'text/x-python' }),
});

test('final confirmation lists each file, size and status without file-management actions', () => {
  const files = [makeFile('1', 6810), makeFile('2', 23), makeFile('3', 934)];
  const markup = renderToStaticMarkup(<FinalSubmissionConfirmation
    isOpen isThai files={files} canFinish statusLabel={() => 'พร้อมส่ง'} onCancel={() => {}} onConfirm={() => {}}
  />);
  for (const file of files) assert.match(markup, new RegExp(file.submissionName));
  for (const label of ['6.65 KB', '23 B', '934 B', 'พร้อมส่ง', 'ยกเลิก', 'เสร็จสิ้นและส่งไฟล์']) {
    assert.ok(markup.includes(label), `missing ${label}`);
  }
  for (const action of ['ดูตัวอย่าง', 'ดูข้อมูลไฟล์', 'ดูโครงสร้าง ZIP', 'เปลี่ยนชื่อ', 'ลบไฟล์']) {
    assert.ok(!markup.includes(action), `unexpected ${action}`);
  }
  assert.equal((markup.match(/<li /g) || []).length, 3);
});

test('cancel and final-submit callbacks retain their original wiring and disabled guard', () => {
  let cancelled = 0;
  let confirmed = 0;
  const props = {
    isOpen: true,
    isThai: true,
    files: [makeFile('1', 6810)],
    canFinish: true,
    statusLabel: () => 'พร้อมส่ง',
    onCancel: () => { cancelled += 1; },
    onConfirm: () => { confirmed += 1; },
  };
  const element = FinalSubmissionConfirmation(props) as React.ReactElement<{
    onClose: () => void;
    footer: React.ReactElement<{ children: React.ReactNode }>;
  }>;
  const buttons = React.Children.toArray(element.props.footer.props.children) as React.ReactElement<{
    onClick: () => void;
    disabled?: boolean;
  }>[];
  assert.equal(buttons.length, 2);
  element.props.onClose();
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.equal(cancelled, 2);
  assert.equal(confirmed, 1);
  assert.equal(buttons[1].props.disabled, false);

  const disabled = renderToStaticMarkup(<FinalSubmissionConfirmation {...props} canFinish={false} />);
  assert.match(disabled, /disabled=""/);
});
