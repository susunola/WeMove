'use strict';
/**
 * Simple bandwidth time-window helper.
 * settings.bandwidthWindows = [{ start: '22:00', end: '08:00', kbps: 0 }, ...]
 * 0 kbps means unlimited.
 */
function getCurrentLimit(windows = [], defaultKbps = 0) {
  if (!Array.isArray(windows) || !windows.length) return defaultKbps;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const w of windows) {
    const [sh, sm] = (w.start || '00:00').split(':').map(Number);
    const [eh, em] = (w.end || '23:59').split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const inWindow = start <= end ? (mins >= start && mins <= end) : (mins >= start || mins <= end);
    if (inWindow) return Number(w.kbps) || 0;
  }
  return defaultKbps;
}
module.exports = { getCurrentLimit };
