'use strict';
/**
 * Batch rename skeleton.
 * Actual rename depends on provider.move or dedicated API.
 */
function planRename(entries, pattern, replacement) {
  return entries.filter(e => !e.isDir).map(e => {
    const next = e.name.replace(new RegExp(pattern, 'g'), replacement);
    return { from: e.name, to: next, changed: next !== e.name };
  }).filter(x => x.changed);
}
module.exports = { planRename };
