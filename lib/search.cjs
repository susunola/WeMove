'use strict';
/**
 * Search helpers.
 * searchInListing: current directory.
 * recursiveSearch: walk subdirs via providers.list (best-effort, limited depth).
 */
function searchInListing(entries, query) {
  if (!query || !Array.isArray(entries)) return [];
  const q = String(query).toLowerCase().trim();
  if (!q) return [];
  return entries.filter(e => (e.name || '').toLowerCase().includes(q)).slice(0, 200);
}

async function recursiveSearch(providers, ref, query, { maxDepth = 2, maxHits = 100, signal } = {}) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const hits = [];
  async function walk(current, depth) {
    if (depth > maxDepth || hits.length >= maxHits || signal?.aborted) return;
    const entries = await providers.list(current, { signal, fresh: false });
    for (const e of entries) {
      if ((e.name || '').toLowerCase().includes(q)) hits.push({ ...e, path: e.ref?.path || e.name });
      if (e.isDir && depth < maxDepth) await walk(e.ref, depth + 1);
      if (hits.length >= maxHits) return;
    }
  }
  try { await walk(ref, 0); } catch {}
  return hits.slice(0, maxHits);
}

module.exports = { searchInListing, recursiveSearch };
