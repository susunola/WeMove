'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../lib/crypt.cjs');

test('crypt roundtrip', () => {
  const plain = Buffer.from('WeMove secret data 0.9');
  const password = 'test-password-123';
  const encrypted = encrypt(plain, password);
  assert.ok(encrypted.length > plain.length);
  const decrypted = decrypt(encrypted, password);
  assert.equal(decrypted.toString(), plain.toString());
});

test('crypt rejects wrong password', () => {
  const plain = Buffer.from('data');
  const encrypted = encrypt(plain, 'right');
  assert.throws(() => decrypt(encrypted, 'wrong'));
});
