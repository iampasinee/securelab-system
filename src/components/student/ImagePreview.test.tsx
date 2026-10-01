import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { changeImageZoom, getDraggedScrollPosition, ImagePreview, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM } from './ImagePreview';

test('raster image preview starts fitted at 100% with accessible controls', () => {
  const markup = renderToStaticMarkup(<ImagePreview url="blob:test-image" filename="preview.png" onError={() => {}} />);
  assert.match(markup, /100%/);
  assert.match(markup, /aria-label="ย่อภาพ"/);
  assert.match(markup, /aria-label="ขยายภาพ"/);
  assert.match(markup, /รีเซ็ต/);
  assert.match(markup, /overflow-auto/);
  assert.match(markup, /src="blob:test-image"/);
  assert.match(markup, /draggable="false"/);
  assert.match(markup, /select-none/);
});

test('pointer-drag deltas compute new scroll offsets', () => {
  const start = { pointerId: 7, clientX: 250, clientY: 220, scrollLeft: 300, scrollTop: 180 };
  assert.deepEqual(getDraggedScrollPosition(start, 190, 140), { left: 360, top: 260 });
  assert.deepEqual(getDraggedScrollPosition(start, 290, 260), { left: 260, top: 140 });
  // The component assigns these values to scrollLeft/scrollTop; the browser clamps at content edges.
});

test('zoom in/out uses 25% steps and enforces 25–300% limits', () => {
  assert.equal(changeImageZoom(100, 'in'), 125);
  assert.equal(changeImageZoom(100, 'out'), 75);
  assert.equal(changeImageZoom(275, 'in'), MAX_IMAGE_ZOOM);
  assert.equal(changeImageZoom(MAX_IMAGE_ZOOM, 'in'), MAX_IMAGE_ZOOM);
  assert.equal(changeImageZoom(50, 'out'), MIN_IMAGE_ZOOM);
  assert.equal(changeImageZoom(MIN_IMAGE_ZOOM, 'out'), MIN_IMAGE_ZOOM);
  assert.equal(changeImageZoom(250, 'reset'), 100);
});

test('each image preview instance starts at 100%', () => {
  const first = renderToStaticMarkup(<ImagePreview key="first" url="blob:first" filename="first.png" onError={() => {}} />);
  const second = renderToStaticMarkup(<ImagePreview key="second" url="blob:second" filename="second.png" onError={() => {}} />);
  assert.match(first, /100%/);
  assert.match(second, /100%/);
  assert.ok(!second.includes('125%'));
});
