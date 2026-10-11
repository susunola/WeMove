'use strict';
/**
 * Client-side encryption skeleton (optional future feature).
 * Uses Node crypto AES-256-GCM. Key derivation is placeholder.
 * Not yet wired into upload/download path.
 */
const crypto = require('crypto');

function deriveKey(password, salt = crypto.randomBytes(16)) {
  return crypto.scryptSync(password, salt, 32);
}

function encrypt(buffer, password) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decrypt(payload, password) {
  const salt = payload.subarray(0, 16);
  const iv = payload.subarray(16, 28);
  const tag = payload.subarray(28, 44);
  const data = payload.subarray(44);
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = { encrypt, decrypt, deriveKey };
