'use strict';
/**
 * Experimental Finder mount helper (macOS).
 * Generates copy-pasteable commands for rclone or Finder.
 */
function mountCommands(provider, ref = {}) {
  const p = (ref.path || '').replace(/^\/+/, '');
  const remote = provider + ':' + (provider === 's3' ? (require('./providers.cjs').makeProviders ? '' : '') : '') + p;
  if (['s3', 'onedrive', 'gdrive', 'dropbox', 'box', 'pcloud', 'mega', 'nextcloud', 'webdav', 'sftp', 'ftp'].includes(provider)) {
    return {
      type: provider,
      suggestion: '推荐用 rclone 挂载（需已配置 remote）',
      commands: [
        `rclone mount ${provider}:${p} ~/${provider}-mount --vfs-cache-mode full --daemon`,
        `# 卸载: umount ~/${provider}-mount  或  fusermount -u ~/${provider}-mount`,
        `# 首次请先 rclone config 配置对应 remote`
      ]
    };
  }
  if (['weiyun', 'pan115', 'nutcloud'].includes(provider)) {
    return {
      type: 'webdav',
      suggestion: '在 Finder 中使用「前往 → 连接服务器」或 rclone mount',
      commands: [
        'webdav:// 地址（服务商控制台查看）',
        `rclone mount webdav: ~/${provider}-mount --daemon  # 需配置 webdav remote`
      ]
    };
  }
  return {
    type: 'unsupported',
    suggestion: '该服务商暂无原生挂载命令，建议继续使用双栏界面',
    commands: []
  };
}

function isMountSupported(provider) {
  return ['s3', 'onedrive', 'gdrive', 'dropbox', 'box', 'pcloud', 'mega', 'nextcloud', 'webdav', 'sftp', 'ftp', 'weiyun', 'pan115', 'nutcloud'].includes(provider);
}

function isMountSupported(provider) {
  return ['s3', 'weiyun', 'pan115', 'nutcloud', 'webdav'].includes(provider);
}

async function mountHint(provider, ref) {
  return mountCommands(provider, ref);
}

module.exports = { mountHint, mountCommands, isMountSupported };
