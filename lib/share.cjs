'use strict';
/**
 * Share link skeleton.
 * Most providers need specific APIs; this returns a placeholder or known pattern.
 */
function shareHint(provider, ref) {
  if (['gdrive', 'onedrive', 'dropbox', 'box'].includes(provider)) {
    return {
      supported: true,
      hint: '可通过服务商网页或 API 生成分享链接（当前为骨架）',
      example: provider + '://share/' + (ref.path || '/')
    };
  }
  if (provider === 's3') {
    return {
      supported: true,
      hint: 'S3 可生成预签名 URL（需配置）',
      example: 'aws s3 presign s3://bucket' + (ref.path || '')
    };
  }
  return { supported: false, hint: '该服务商暂不支持一键分享链接' };
}
module.exports = { shareHint };
