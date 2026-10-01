import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BackButton } from './BackButton';
import { SecureLabBrandHeader } from './SecureLabBrandHeader';

test('branding-only header stays compact for landing and early exam steps', () => {
  const markup = renderToStaticMarkup(<SecureLabBrandHeader />);

  assert.match(markup, /<header[^>]*h-16/);
  assert.match(markup, /max-w-7xl/);
  assert.match(markup, /SecureLab/);
  assert.match(markup, /ระบบจัดการการสอบในห้องปฏิบัติการ/);
  assert.doesNotMatch(markup, /<button|ออกจากระบบ|เข้าสู่ระบบด้วยบัญชี ICIT|เครือข่ายแลนภายในปลอดภัย/);
});

test('exam context is rendered inside the shared navbar when provided', () => {
  const markup = renderToStaticMarkup(
    <SecureLabBrandHeader examControls={<span>CS301 • LAB 301 • ที่นั่ง A1</span>} />,
  );

  assert.match(markup, /<header[\s\S]*CS301 • LAB 301 • ที่นั่ง A1[\s\S]*<\/header>/);
  assert.match(markup, /SecureLab/);
});

test('shared BackButton is a compact, accessible icon button', () => {
  const markup = renderToStaticMarkup(<BackButton onClick={() => undefined} />);

  assert.match(markup, /aria-label="ย้อนกลับ"/);
  assert.match(markup, /h-10 w-10/);
  assert.match(markup, /rounded-xl/);
  assert.doesNotMatch(markup, /กลับหน้าหลัก/);
});
