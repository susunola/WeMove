# Additional storage services / 扩展存储

The Add storage catalog contains services that are not already in the sidebar. Adding a service creates a separate account; it appears in the sidebar, while S3 remains last. Existing services use their Accounts button.

“添加存储”只显示左侧尚未添加的服务。添加后创建独立账号并显示在侧栏，S3 始终放在最后。已有服务通过“账号”管理更多账号。

| Service | Connection | Limits |
| --- | --- | --- |
| Google Drive, Dropbox, Box, pCloud | rclone browser OAuth; advanced token import | Provider may require app approval; authorization can be revoked. |
| MEGA | Email and password | Two-factor accounts are not supported by this integration. |
| Nextcloud | WebDAV URL and application password | Use the complete user DAV path. |
| WebDAV | URL, username, password | HTTPS preferred; HTTP is available for LAN servers. |
| FTP / FTPS | Host, port, username, password; explicit TLS default | Match the server TLS mode; implicit TLS commonly uses port 990. |
| SFTP | Host, port, username, password, absolute known_hosts file | Host identity verification is required; password authentication only in this form. |
| SMB | Host, port, username, password, domain | Shares appear as folders at the root. |

Credentials remain in the existing local encrypted vault. Connection validation restores previous configuration on failure. All adapters use the shared queue, recovery, conflict handling and verification paths. Upload resume support depends on the backend; new services do not automatically gain S3/OneDrive upload sessions.

凭据使用现有本机加密存储；连接验证失败会恢复原配置。新增适配器复用传输队列、恢复、冲突处理和校验。上传断点能力取决于后端，不能将 S3/OneDrive 的分片会话能力理解为全部服务都具备。

Validation: real local WebDAV server listing/upload/download/move; configuration rollback and input validation; catalog search, icons, layout and 2,000-task UI checks. External cloud accounts and FTP/SFTP/SMB servers still require user-account integration testing.

验证：真实本地 WebDAV 服务器目录读取、上传、下载及移动；配置回滚和参数校验；目录搜索、图标、布局和 2,000 任务界面验证。外部云账号及 FTP/SFTP/SMB 服务器仍需真实账号集成验证。
