# Enterprise shared drives / 企业共享盘

Add storage now offers **OneDrive for Business**, **SharePoint**, and **Google Shared Drives**. Each account connection selects one drive/document library and uses the existing queue for copying in either direction. Add separate connections for more libraries.

“添加存储”新增 **OneDrive 企业版、SharePoint、Google 共享云盘**。每个账号连接对应一个云盘/文档库，可作为源或目标；多个文档库分别添加连接。

## Connect / 连接

- OneDrive for Business: sign in with a work/school account and select the business drive. A personal drive is rejected.
- SharePoint: sign in with Microsoft 365; choose site search, site URL, root site, or advanced site/drive ID; choose the document library and confirm. Teams channel files live in the associated SharePoint library, not a separate Teams file backend.
- Google Shared Drives: sign in with a Workspace account; the connector automatically requests shared-drive selection and lists the drives available to that account. An empty shared-drive selection is rejected.

- OneDrive 企业版：工作/学校账号授权后选择企业云盘，拒绝个人云盘。
- SharePoint：Microsoft 365 授权后可按站点搜索、地址、根站点或高级 ID 选择站点，再选择和确认文档库。Teams 频道文件使用对应 SharePoint 文档库。
- Google 共享云盘：Workspace 授权后自动进入共享云盘选择，列出账号可见的云盘，不能空选或退回个人云盘。

Organization administrator consent and library-level read/write permissions may be required. This feature copies file content and folder structure; it does not migrate memberships, sharing links, permissions, version histories, SharePoint lists/pages or Google-native document semantics. Google-native documents are currently excluded from the Shared Drive listing; export is not yet implemented.

组织可能要求管理员批准应用及授予文档库读写权限。仅搬运文件内容和目录结构，不迁移成员、分享链接、权限、版本历史、SharePoint 列表/页面或 Google 原生文档语义。Google 原生文档当前不在共享云盘目录中显示，导出功能尚未实现。

## Safety and validation / 安全与验证

Library IDs are hashed into directory references. After reconfiguring a connection to another library, old references/tasks are rejected rather than silently targeting the new library. OAuth success is announced only after validating the library type and reading its root directory. Microsoft enterprise uploads reuse the checkpointed Graph upload-session implementation.

文档库 ID 被纳入目录引用。更换连接的文档库后，旧引用/任务会拒绝执行，避免写错位置；仅在校验库类型并成功读取根目录后显示授权成功。Microsoft 企业上传复用 Graph 上传会话和检查点。

Automated validation covers OAuth wizard transitions with a simulated client, wrong drive types, stale library references, existing transfer tests, and browser catalog/form behavior. No real organization tenant was available for this implementation; administrator policies and live tenant transfer behavior require actual-account verification.

自动化验证覆盖模拟客户端授权步骤、错误云盘类型、旧文档库引用、现有传输测试和浏览器目录/表单交互。本次没有真实组织租户，管理员策略和真实租户传输仍需要实际账号验证。

References: [OneDrive/SharePoint backend](https://rclone.org/onedrive/), [Google Shared Drives](https://rclone.org/drive/#shared-drives-team-drives).
