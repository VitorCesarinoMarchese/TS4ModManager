# Native management migration

Historical record from before the React/Tauri app was retired. Source paths and validation commands describe that revision. The current app lives in `native/`, with its Rust library in `core/`. See the [current setup instructions](development.md).


The user authorized all seven remaining workstreams on 2026-10-08. Preserve the existing managed storage and metadata, keep the React/Tauri app usable during the migration, and keep mod downloads and updates excluded.

## Completion criteria

- Core regression tests prove ownership checks, dangling-link handling, instance-specific bookkeeping, migration compatibility, collision preflight, and recoverable failure paths.
- Temporary fixtures complete folder/ZIP import, external migration, enable, disable, rename, explicit source attachment/removal, trash, and restore without losing original bytes or metadata.
- The native UI exposes these workflows with confirmation where required, progress, recoverable errors, and background processing. Stale results cannot update another instance or mod.
- Native settings persist locally, API keys remain outside mod metadata and logs, and an explicit local export/import transfers existing app settings.
- A repeatable script builds a Linux release artifact with licenses and desktop integration. CI validates the native crate and fixture workflows alongside the existing app.
- Release measurements compare startup, memory, search, and scrolling with the existing app where the environment supports a valid comparison. Desktop checks report verified and unavailable input/platform combinations separately.
- All required project validation commands and native tests/build/clippy pass. Each completed unit has a verified signed commit.

## Work units and order

1. Ground the existing core and native caller flows. Compare two ownership and operation-controller designs, then document the chosen interfaces.
2. Add failing core safety regressions. Repair containment, link ownership, per-instance bookkeeping, migration, import staging, trash transfer, and restore preflight in independently verified units.
3. Repair source-provider production isolation and retained frontend state/error defects.
4. Extend the native controller with serialized mutation jobs, stable operation identity, progress, issues, and refreshed catalog state.
5. Add import/migration and reviewed enable/disable workflows. Add managed-only trash/restore, rename, and explicitly confirmed source attachment/removal.
6. Add persisted native settings and explicit settings transfer from the existing app.
7. Add packaging and CI. Exercise feature workflows through the actual binary, capture native layouts, and record release measurements and desktop coverage.

## Constraints and verification

This changes approximately six core file-management modules, source lookup, the native controller/UI, settings transfer in both interfaces, and build infrastructure. Filesystem mutations require stronger evidence than reversible layout changes. Tests and fixture scripts precede feature exposure; no test operates on the user's real mod collection. Parallel implementation uses isolated worktrees and merges at verified boundaries.

The current worker is a read-only scan worker. Mutation jobs must not inherit its replaceable pending-request behavior. A queued user-approved write must either run once or report that it was rejected; it cannot disappear when another scan arrives.

Signing may require the user's desktop key prompt. Physical touchpad, multiple-monitor, and screen-reader behavior cannot be inferred from headless tests; any unavailable checks remain explicitly unverified.

The decision trail is [native-migration-decisions.tsv](native-migration-decisions.tsv).
