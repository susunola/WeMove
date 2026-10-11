'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mountHint, isMountSupported } = require('../lib/mount.cjs');

test('mount support detection', () => {
  assert.equal(isMountSupported('s3'), true);
  assert.equal(isMountSupported('weiyun'), true);
  assert.equal(isMountSupported('ali'), false);
  assert.equal(isMountSupported('onedrive'), false);
});

test('mount commands for s3', async () => {
  const hint = await mountHint('s3', { path: 'mybucket/folder' });
  assert.equal(hint.type, 's3');
  assert.ok(hint.commands.some(c => c.includes('rclone mount')));
});

test('mount hints for webdav-like', async () => {
  const hint = await mountHint('nutcloud', { path: '/docs' });
  assert.equal(hint.type, 'webdav');
});

test('unsupported provider', async () => {
  const hint = await mountHint('ali', {});
  assert.equal(hint.type, 'unsupported');
});
