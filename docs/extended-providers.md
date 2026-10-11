# iCloud Drive, Tencent Weiyun and 115 Drive

| Provider | Connection | Requirements |
| --- | --- | --- |
| iCloud Drive | rclone iCloud Drive backend | Apple ID account password and two-factor authentication; not an app-specific password |
| Tencent Weiyun | OpenList / WebDAV gateway | A mounted Weiyun folder and gateway credentials |
| 115 Drive | OpenList / WebDAV gateway | A mounted 115 folder and gateway credentials |

S3 is last in both provider selectors and the sidebar. iCloud Photos is not part of this integration. iCloud is an experimental upstream backend; its trust token expires and reauthentication can be required. The Weiyun upstream driver uses a legacy reverse-engineered interface that OpenList does not actively maintain. These integrations must not be described as certified production compatibility or native Weiyun/115 login.

## Gateway setup

Mount the provider in your own OpenList instance, enable WebDAV read permissions, and enter the mounted folder URL (for example `https://your-host/dav/115/`), gateway username and password in WeMove. Use HTTPS, or HTTP on localhost. A remote read-only driver or gateway permission does not gain upload or move support through WeMove. Upload/download/move behavior depends on that gateway and upstream provider.

A failed gateway connection restores the previous rclone configuration. Passwords are obscured through stdin and the resulting configuration is stored in the existing encrypted credential vault. iCloud verification answers are passed to rclone via its RCLONE_RESULT environment option, not command arguments.

## Verification

119 automated tests pass, including real local rclone WebDAV listing, upload, download and move for both gateway aliases, invalid configuration rejection, rollback, and a simulated iCloud two-factor state machine. UI fixtures cover nine providers, compact layouts, English forms, and S3 ordering. No real Apple, Weiyun or 115 account was used; end-to-end provider compatibility remains to be verified with connected accounts.

## References

- https://rclone.org/iclouddrive/
- https://doc.oplist.org/guide/drivers/weiyun
- https://doc.oplist.org/guide/drivers/115_open
- https://pages.doc.oplist.org/guide/advanced/webdav

## 中文

iCloud Drive 使用 Apple ID 密码与双重认证，通过 rclone 后端连接；不包含照片。腾讯微云和 115 通过 OpenList / WebDAV 网关接入，必须先挂载网盘，再填写挂载目录地址和网关账号。可用读写操作取决于网关驱动及权限。S3 始终在列表最后。

微云旧驱动未主动维护，iCloud 上游后端仍属实验性；尚未使用真实账号做端到端验证。升级时不打断正在传输的任务，新入口和后端在应用下次重启后启用。
