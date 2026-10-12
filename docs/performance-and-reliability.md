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

## Repeated forced-restart validation

`node tools/soak-transfer.cjs 30` runs an isolated fixture: 80 files in eight folders per round, intermittent simulated timeouts, three SIGKILL interruptions at the upload-before-receipt boundary, then resume and byte-for-byte comparison. It rejects duplicate uploads rather than silently overwriting them. The fixture never uses user credentials or cloud accounts.

On the bundled Node runtime, 30 rounds passed: 2,400 files and 90 forced process restarts. A further 10 rounds passed with the development runtime: 800 files and 30 restarts. See `designs/soak-results.json` and `designs/soak-results-node25.json` for elapsed times and per-round results. This is repeated controlled fault injection, not an hours-long real-cloud soak or physical sleep/wake certification.

The validation also adds signed-download-link renewal on a first 401/403 response and verifies that canceling a paced transfer releases its bandwidth reservation.

## Small-file pipeline and incremental checkpoints

Quark metadata commands and transfers up to 2 MiB reuse bounded Node workers and TCP connections. Each command gets a fresh VM context; workers recycle after 16 commands or excess RSS. Unsupported CLI layouts fall back before execution; failed uploads are never automatically replayed through a different client. Only the CLI's final telemetry flush is omitted. Login and larger transfers retain the original process path. Set `WEMOVE_DISABLE_QUARK_POOL=1` to disable reuse.

A four-file real-account check with random 32 KiB payloads alternated original and reused clients: mean upload duration decreased from 6.90 s to 1.52 s. Every payload passed SHA-256 readback. This small sample measures fixed command overhead, not a general cloud speed guarantee; see `designs/quark-small-file-benchmark.json`.

Signed download URLs use an in-memory per-file lease with concurrent refresh coalescing. Each HTTP range retries transient failures independently, leaving committed sibling ranges intact. Network idle deadlines exclude intentional throttling and disk writes. Small files get priority with reserved opportunities for older large files. Completion throughput and files per minute complement phase speed; command latency metrics represent client commands rather than underlying API request counts.

SQLite stores directory, parent and pending scan records separately from job metadata. Completed file updates no longer rewrite the directory tree. Recovery inspection reconciles uncertain moves only after a fresh target match and confirmed source absence; lookup errors never prove absence.

The updater now snapshots the task database before migration and restores it with the old application on startup failure. A manual downgrade also requires its matching database snapshot: the older application cannot safely read the new checkpoint schema.

本轮针对小文件固定开销、分段重试、大小文件公平调度和增量检查点优化。真实小样本上传平均从 6.90 秒降至 1.52 秒，已逐项回读校验；不代表所有网盘或大文件都有同等提升。手动降级需要同时恢复对应数据库快照。
