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
        `# 卸载: fusermount -u ~/s3-mount  或  umount ~/s3-mount`,
        `# 首次使用前请确保 rclone config 中已配置 s3 remote`
      ]
    };
  }
  if (['weiyun', 'pan115', 'nutcloud', 'webdav'].includes(provider)) {
    return {
      type: 'webdav',
      suggestion: '在 Finder 中使用「前往 → 连接服务器」',
      commands: [
        'webdav:// 或 smb:// 地址（在服务商控制台查看）',
        '# 示例: webdav://your-server/dav/',
        '# 也可尝试 rclone mount webdav: ~/webdav-mount --daemon'
      ]
    };
  }
  if (provider === 'onedrive') {
    return {
      type: 'onedrive',
      suggestion: '可使用 rclone 挂载 OneDrive',
      commands: [
        'rclone mount onedrive: ~/onedrive-mount --vfs-cache-mode full --daemon',
        '# 需先 rclone config 配置 onedrive'
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
