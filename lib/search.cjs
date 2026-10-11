'use strict';
/**
 * Search helpers.
 * searchInListing: current directory.
 * collectMatches: recursive-style collector (caller supplies walker).
 */
function searchInListing(entries, query) {
  if (!query || !Array.isArray(entries)) return [];
  const q = String(query).toLowerCase().trim();
  if (!q) return [];
  return entries.filter(e => (e.name || '').toLowerCase().includes(q)).slice(0, 200);
}

function collectMatches(entries, query, max = 200) {
  const hits = searchInListing(entries, query);
  return hits.slice(0, max);
}

module.exports = { searchInListing, collectMatches };
