'use strict';
/**
 * Simple local notification helper (best-effort).
 * On macOS this can be extended to call the Swift launcher;
 * for now it logs and can be hooked by the UI poll.
 */
function notify(title, body) {
  console.log('[notify]', title, body);
  // Future: write a small file that the launcher watches, or use child_process to osascript
  try {
    const { execFile } = require('child_process');
    execFile('osascript', ['-e', `display notification "${String(body).replace(/"/g, '\\"')}" with title "${String(title).replace(/"/g, '\\"')}"`], { timeout: 2000 }, () => {});
  } catch {}
}
module.exports = { notify };
