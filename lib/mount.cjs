'use strict';
/**
 * Experimental Finder mount helper (macOS).
 * Currently supports documenting WebDAV/S3 mount commands.
 * Full macFUSE integration is optional and external.
 */
const {exec} = require('./common.cjs');

async function mountHint(provider, ref) {
  if (provider === 's3') {
    return {
      type: 's3',
      suggestion: 'Use rclone mount or Cyberduck for S3 volumes',
      command: `rclone mount s3:${ref.path || ''} /tmp/s3-mount --daemon`
    };
  }
  if (['weiyun', 'pan115', 'nutcloud'].includes(provider)) {
    return {
      type: 'webdav',
      suggestion: 'Mount via WebDAV using Finder > Connect to Server',
      url: 'webdav://...'
    };
  }
  return { type: 'unsupported', suggestion: 'Native mount not yet available for this provider' };
}

function isMountSupported(provider) {
  return ['s3', 'weiyun', 'pan115', 'nutcloud'].includes(provider);
}

module.exports = { mountHint, isMountSupported };
