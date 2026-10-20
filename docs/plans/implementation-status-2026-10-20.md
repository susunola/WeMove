# Implementation and validation — 2026-10-20

This is an incremental delivery against the performance/reliability plan, not a claim that all acceptance targets have been met.

Implemented:

- CI matrix for Node 22/24 on Linux/macOS with pinned platform-specific rclone and checksum verification. Workflow publication uses the newly authorized token; hosted results must be checked separately from local validation.
- Three local transfer workloads, three rounds each, strict readback; comparable-baseline checker rejects >10% median duration regressions. Matching hardware/network remains an operator requirement. The initial baseline is not a demonstrated speedup.
- Bounded Quark worker queues, cooldown after repeated process failures, queued-account fairness, execution-before-fallback protection using the verified CLI fingerprint.
- Asynchronous coalesced cache scanning on a worker thread; expired results refreshed and symlinks ignored. Maintenance-only cache deletion retains its existing drained-transfer requirement.
- Paged task-record reads; completed/canceled jobs saved by this version can load summaries first and load file details on demand. Active jobs still keep file objects in memory. SQLite commits still run synchronously with FULL durability.
- Stream tuning cooldown after network/rate failures; sub-8 MiB samples are treated as fixed-latency samples. Existing verified same-account server-copy paths remain in place; cross-provider streaming is not enabled.
- Runtime memory/event-loop diagnostics, bounded P50/P95 command samples and whitelist-based redacted diagnostic export.
- Adapter capability declarations explicitly distinguish implemented paths from real-account certification.
- Database schema guard, quick integrity/space preflight, matching app/database backup, build-identity startup validation and safe pause/drain/update/resume wrapper.
- Reproducible content/dependency manifest tool and explicit foreground long-run local validation runner.

Evidence:

- 182 Node tests passed before the final build-identity wiring; subsequent focused HTTP/worker/hardening suite: 13 passed. Python updater preflight test passed.
- 800 synthetic files, 30 forced restarts: passed. UI fixture checks passed in Chinese/English and compact layout.
- Nine local queue benchmark rounds passed; results are in `designs/benchmark-transfer-2026-10-20.json`. Synchronous fixture file I/O contributes to large-file event-loop measurements; these are not real-cloud throughput figures.

Still pending:

- Full active-job disk-backed scheduling / SQLite worker isolation, profiling and the 100k-file responsiveness target.
- Matched real-cloud before/after throughput trials, including the proposed ≥15% improvement target. Adaptive concurrency beyond the existing conservative bounds needs that evidence.
- 8-hour/24-hour tests, physical sleep/wake and real network outages. The runner is provided; these durations have not elapsed in this delivery.
- Real enterprise tenant permission and resume checks, complete native/gateway capability certification.
- Public Developer ID signing/notarization needs the owner's Apple credentials; local ad-hoc signatures are not public release signing.

No unattended scheduling was added. Existing unrelated local design drafts are excluded from this delivery.
