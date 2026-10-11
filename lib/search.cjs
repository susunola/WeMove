'use strict';
/**
 * Basic cross-pane / provider search foundation.
 * Returns matching entries from a single listing (can be extended to recursive).
 */
function searchInListing(entries, query) {
  if (!query || !Array.isArray(entries)) return [];
  const q = String(query).toLowerCase().trim();
  if (!q) return [];
  return entries.filter(e => (e.name || '').toLowerCase().includes(q)).slice(0, 200);
}
module.exports = { searchInListing };
