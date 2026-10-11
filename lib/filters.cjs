'use strict';
/**
 * Basic file filters for transfers and sync plans.
 * Supports extension exclude, max size, name patterns.
 */
function compileFilters(opts = {}) {
  const excludeExt = new Set((opts.excludeExt || []).map(x => String(x).trim().toLowerCase().replace(/^\./, '')));
  const maxSize = Number(opts.maxSize) > 0 ? Number(opts.maxSize) : Infinity;
  const minSize = Number(opts.minSize) > 0 ? Number(opts.minSize) : 0;
  const excludeNames = (opts.excludeNames || []).map(x => new RegExp(x, 'i'));
  const maxAgeMs = Number(opts.maxAgeDays) > 0 ? Number(opts.maxAgeDays) * 86400000 : Infinity;
  const minAgeMs = Number(opts.minAgeDays) > 0 ? Number(opts.minAgeDays) * 86400000 : 0;
  const now = Date.now();
  return function filter(entry) {
    if (!entry || entry.isDir) return true;
    const name = (entry.name || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    if (excludeExt.has(ext)) return false;
    if (entry.size > maxSize || entry.size < minSize) return false;
    if (excludeNames.some(re => re.test(name))) return false;
    const modified = entry.modified ? new Date(entry.modified).getTime() : 0;
    if (modified && (now - modified > maxAgeMs || now - modified < minAgeMs)) return false;
    return true;
  };
}
function describe(opts) {
  const parts = [];
  if (opts.excludeExt?.length) parts.push('排除扩展名: ' + opts.excludeExt.join(','));
  if (opts.maxSize) parts.push('最大 ' + opts.maxSize + ' 字节');
  if (opts.minSize) parts.push('最小 ' + opts.minSize + ' 字节');
  if (opts.maxAgeDays) parts.push('最近 ' + opts.maxAgeDays + ' 天');
  if (opts.minAgeDays) parts.push('至少 ' + opts.minAgeDays + ' 天前');
  return parts.join('; ') || '无过滤器';
}
module.exports = { compileFilters, describe };
