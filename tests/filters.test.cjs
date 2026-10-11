'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compileFilters, describe } = require('../lib/filters.cjs');

test('filters exclude extensions', () => {
  const f = compileFilters({ excludeExt: ['.tmp', 'log'] });
  assert.equal(f({ name: 'a.tmp', size: 10, isDir: false }), false);
  assert.equal(f({ name: 'b.log', size: 10, isDir: false }), false);
  assert.equal(f({ name: 'c.txt', size: 10, isDir: false }), true);
  assert.equal(f({ name: 'dir', size: 0, isDir: true }), true);
});

test('filters size bounds', () => {
  const f = compileFilters({ minSize: 100, maxSize: 1000 });
  assert.equal(f({ name: 'small', size: 50, isDir: false }), false);
  assert.equal(f({ name: 'ok', size: 500, isDir: false }), true);
  assert.equal(f({ name: 'big', size: 2000, isDir: false }), false);
});

test('filters name patterns', () => {
  const f = compileFilters({ excludeNames: ['cache', '^temp'] });
  assert.equal(f({ name: 'mycache.txt', size: 10, isDir: false }), false);
  assert.equal(f({ name: 'tempfile', size: 10, isDir: false }), false);
  assert.equal(f({ name: 'normal', size: 10, isDir: false }), true);
});

test('filters age bounds', () => {
  const f = compileFilters({ maxAgeDays: 7, minAgeDays: 1 });
  const recent = { name: 'new.txt', size: 10, isDir: false, modified: new Date(Date.now() - 2 * 86400000).toISOString() };
  const old = { name: 'old.txt', size: 10, isDir: false, modified: new Date(Date.now() - 10 * 86400000).toISOString() };
  const veryNew = { name: 'brand.txt', size: 10, isDir: false, modified: new Date().toISOString() };
  assert.equal(f(recent), true);
  assert.equal(f(old), false);
  assert.equal(f(veryNew), false);
});
