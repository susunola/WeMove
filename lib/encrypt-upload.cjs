'use strict';
/**
 * Optional client-side encryption helper for uploads.
 * Currently a skeleton: encrypts a buffer if password is provided.
 * Not yet fully integrated into the transfer pipeline.
 */
const { encrypt } = require('./crypt.cjs');
const fs = require('fs');

async function maybeEncryptFile(filePath, password, signal) {
  if (!password) return filePath;
  const data = fs.readFileSync(filePath);
  const encrypted = encrypt(data, password);
  const out = filePath + '.enc';
  fs.writeFileSync(out, encrypted);
  return out;
}

module.exports = { maybeEncryptFile };
