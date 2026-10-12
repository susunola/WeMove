# Performance and reliability / 性能与可靠性

This release uses a persistent breadth-first scan cursor and a transfer pipeline. Each discovered directory batch commits file records and the next scan cursor together. Uploads can start before the full tree is scanned. Empty directories are created before completion. Pausing preserves discovered files, completed receipts and the remaining scan cursor. A later scan failure does not erase files already copied.

本轮增加持久化扫描游标，扫描与传输并行；暂停保留已发现文件和完成回执。后续目录扫描失败时，先前完成的文件不会被撤回，结果显示部分失败。

- Ali files and directories are addressed by file ID. Real duplicate names receive deterministic target aliases containing a short ID digest; source names remain unchanged. Ali downloads journal complete HTTP ranges and verify the provider hash afterwards.
- Metadata reads reuse a short directory cache and concurrent requests. Fresh validation bypasses cached results; mutations invalidate the cache. This is intentionally conservative around overwrite checks.
- Job totals update from changed records rather than re-scanning every file. SSE sends changed jobs with backpressure protection; periodic polling remains a reconnect fallback.
- Completed tasks distinguish success and completion with skipped items. Reports retain source conflicts and per-file verification grades. Incomplete-item exports never include credentials or signed URLs.
- Download/upload rates are sampled independently. ETA is an estimate using available phase rates and is hidden until scanning completes.
- Rate limits cover native Ali/HTTP/rclone downloads, native S3 multipart and OneDrive chunks, and rclone upload processes. Dedicated Quark/Ali upload/Baidu clients are not universally throttled. Chunk pacing is an average rate, not an instantaneous network traffic guarantee.

## Validation / 验证

`node --test tests/*.test.cjs` covers retry, canceled waits, low disk space checks, interrupted multipart sessions, changed-source detection, strict readback corruption, SQLite transaction recovery and scan/transfer overlap. HTTP fixtures simulate a broken range and ensure already committed ranges are not fetched again. These controlled faults are not a substitute for long-duration tests with real accounts or physical sleep/wake tests.

`node tools/benchmark-core.cjs` measures **local state aggregation only**, at 1k, 10k and 100k files. It does not claim cloud throughput improvement. Use the same cloud file set, account, network, concurrency and verification mode for before/after transfer tests; capture first-file latency, total duration, API requests, RSS, and bytes resent after interruption.

## Upgrade / 更新

`python3 tools/update-local.py` validates syntax, requires transfers to be drained, backs up the complete application bundle, verifies its local signature, installs and checks startup. Failed startup restores the prior bundle. It does not delete cloud files or change credentials. Keep the rollback bundle until validation finishes; pause tasks before any manual downgrade.

Local installation uses an ad-hoc signature. Public macOS distribution still requires an Apple Developer ID Application identity, notarization credentials, signing and notarization of the final artifact. No such identity or notarization profile has been assumed. Unattended scheduling remains outside this work.

本机安装签名与公开发行的 Developer ID 签名不是一回事。公开发布仍需对应 Apple 开发者证书和公证凭据；未虚构已完成公证。真实企业租户、断网、睡眠唤醒和限流行为需要长期实机验证。
