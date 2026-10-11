'use strict';
/**
 * Simple bandwidth limiter (bytes per second).
 * 0 = unlimited.
 */
function createBandwidthLimiter(getLimit) {
  let tokens = 0;
  let last = Date.now();
  return async function throttle(bytes, signal) {
    const limit = Number(getLimit()) || 0;
    if (limit <= 0 || bytes <= 0) return;
    const now = Date.now();
    const elapsed = (now - last) / 1000;
    tokens = Math.min(limit, tokens + elapsed * limit);
    last = now;
    if (bytes > tokens) {
      const wait = ((bytes - tokens) / limit) * 1000;
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, wait);
        signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(Error('已暂停'), { name: 'AbortError' })); }, { once: true });
      });
      tokens = 0;
    } else {
      tokens -= bytes;
    }
  };
}
module.exports = { createBandwidthLimiter };
