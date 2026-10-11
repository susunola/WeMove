# Transfer reliability and throughput improvements

- Retrying files release the global/account transfer slot while waiting, allowing other jobs to make progress. Retries reacquire the same limiter and retain their original phase and checkpoints.
- Exponential backoff includes up to 25% jitter to avoid simultaneous retry bursts. Existing retry limits and adaptive concurrency remain in force.
- Progress aggregation runs at most every 100 ms during intermediate data callbacks; file completion and cleanup still update immediately. This reduces repeated full-list scans for large tasks.
- Single-stream and range downloads mark cached progress as resumed, excluding previously downloaded bytes from network speed samples.
- Download subprocesses with no output for 90 seconds are terminated; a process ignoring termination is killed after another 5 seconds. The ordinary retry path retains sequential partial bytes and only durable, complete range checkpoints.

These changes do not bypass provider rate limits or prove a particular throughput gain. Upload clients retain their existing timeout behavior. A slow hash or scan is not covered by the download watchdog.

Validation: 110 automated tests pass, including healthy-job scheduling during another job's retry, pause during retry, real subprocess stalls, sequential resume, and rejection of incomplete range checkpoints. Tests use isolated fixtures, not user cloud accounts.

## 中文

重试等待时释放传输名额；指数退避增加随机错峰；中间进度统计降至每 100 毫秒一次；已有缓存不计入新下载速度。下载子进程连续 90 秒无数据时终止，保留断点重试。分段下载只复用已经完整写入并持久化的分块。

当前运行的核心进程不会热更新。安装后，下次退出并重新打开应用生效；有任务运行时不要为了更新强制结束进程。此改动不突破网盘限速，上传、扫描和哈希阶段仍使用原有机制。

## Deletion during transfers

Unrelated files can be moved to recovery during transfers. Active and queued tasks protect their selected source/target paths, descendants, ancestors, and renamed destinations. Provider, account and explicit drive identities are respected; an unresolved drive is treated conservatively. Authorization and plan scans still block deletion. Rejected deletion displays its reason inside the confirmation dialog. Queued work is awakened after deletion finishes. Recovery uses the selected account.

112 automated tests passed; additional focused coverage checks unresolved drive protection and deletion failure feedback in the UI. Real transfers were left running, so core changes take effect on the next app restart.
