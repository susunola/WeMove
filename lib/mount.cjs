'use strict';
/**
 * Experimental Finder mount helper (macOS).
 * Generates copy-pasteable commands for rclone or Finder.
 */
function mountCommands(provider, ref = {}) {
  const path = (ref.path || '').replace(/^\/+/, '');
  if (provider === 's3') {
    const remote = 's3:' + (path || '');
    return {
      type: 's3',
      suggestion: '推荐用 rclone 挂载（需已配置 remote）',
      commands: [
        `rclone mount ${remote} ~/s3-mount --vfs-cache-mode full --daemon`,
        `# 卸载: fusermount -u ~/s3-mount  或  umount ~/s3-mount`
      ]
    };
  }
  if (['weiyun', 'pan115', 'nutcloud', 'webdav'].includes(provider)) {
    return {
      type: 'webdav',
      suggestion: '在 Finder 中使用「前往 → 连接服务器」',
      commands: [
        'smb:// 或 webdav:// 地址（在服务商控制台查看）',
        '# 示例: webdav://your-server/dav/'
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
  return ['s3', 'weiyun', 'pan115', 'nutcloud', 'webdav'].includes(provider);
}

async function mountHint(provider, ref) {
  return mountCommands(provider, ref);
}

module.exports = { mountHint, mountCommands, isMountSupported };
