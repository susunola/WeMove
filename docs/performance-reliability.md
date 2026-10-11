# Transfer performance and reliability

## Implemented

- Aliyun commands use private writable credential snapshots. A single-flight preflight validates the account before commands run (cached for 60 seconds); token updates merge only when their expiry is newer. Client snapshots cannot replace the active account or overwrite unrelated account settings.
- Quark commands use private client configuration and merge newer account credentials back. Rclone commands use private configurations and merge newer OAuth tokens without replacing other sections. OneDrive native uploads refresh through rclone before creating a session.
- Download and upload have separate global and per-account limiters. Up to twice the configured file concurrency can move through the pipeline, while each network phase respects its own limit. Staging reservations default to 4 GiB and are configurable from 1–64 GiB; larger individual files run alone. Actual disk free space is checked separately.
- Transfer tuning learns throughput per provider/account/direction, adjusts streams within 1–4 and selects 16/32/64 MiB blocks. Rate limits back off; existing download journals retain their original block geometry. Provider clients may impose their own limits.
- Hashing runs in a bounded pool of two worker threads. Multipart buffers share a 128 MiB budget across uploads (a required larger part is admitted alone); upload file reads are asynchronous. S3 SDK clients reuse connections.
- Metadata listings have bounded concurrency; target folder creation is single-flight within a job. Noncritical running-task metadata is coalesced for 200 ms; file checkpoints and receipts still commit immediately with SQLite FULL durability. Progress aggregation updates only the changed file.
- S3 completion records are written before committing the multipart upload. If the completion response is lost and the session disappears, recovery verifies object size and the stored SHA-256 metadata before acknowledging completion. OneDrive disappeared final sessions require remote SHA-1 verification; ambiguous outcomes stop for inspection instead of blindly recreating the upload.
- Queue rows update individually and virtualize above 100 tasks. Side navigation supports search and a storage catalog, including the existing account-management flow. Task tooltips show separate upload/download rates; phase hints identify hashing, channel waits and staging waits.

## Validation

Automated tests cover concurrent credential writes, failed-refresh retry, lost multipart completion responses, SIGKILL after durable checkpoint commits, disk errors, expired destination authorization, cancellation, bounded staging and pipeline overlap. Existing protocol fixture tests cover S3, OneDrive sessions and ranged downloads. Browser checks exercise 2,000 tasks, scrolling, column sorting, storage search and the catalog, alongside the existing dialog and interaction suite.

## Limits

These are local fault and protocol-fixture tests, not a certification of every cloud provider. Actual throughput must be measured on representative large-file, small-file and deep-directory workloads. CLI-backed adapters still launch client processes; S3 native clients reuse connections. A remote provider can revoke authorization or expire upload sessions. Remote folders can change between verification and later use. No unattended scheduling was added.

The installed native app must restart to load backend changes. Account credentials and unfinished file checkpoints remain in the existing application data directory.
