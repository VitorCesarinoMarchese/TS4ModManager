# Native management design

The existing Rust core remains the authority for filesystem and provider operations. Both React/Tauri and the Fastframe UI use its existing public functions and serialized results. Managed metadata stays version 1, with its existing fields and storage location.

## Chosen structure

Two independent designs were grounded in the current source and repository history. Design A proposed separate per-instance ownership files and an operation engine. Design B proposed one version-2 sidecar containing every instance and operation-specific recovery records. Both required exact link verification, a shared writer lock, bounded import, original preservation and a separate native mutation queue.

Use A's per-instance files. They isolate updates and let the ambiguous version-1 sidecar remain untouched. Use B's preserved source holdings for cross-filesystem transfers. Keep the existing operation functions instead of adding a broad `Manager` forwarding interface. Core modules own validation, locking and recovery; UI adapters own review and asynchronous job state.

| Boundary | Owner |
| --- | --- |
| Safe components, relative paths, parent containment and atomic writes | `fs_scope` |
| Version-1 metadata and complete staged folder import | `managed_storage` |
| Per-instance link records and legacy sidecar decoding | `link_ownership` |
| Shared mutation lock, durable operation records and recovery | `operation` |
| Bounded ZIP extraction | `archive_import` |
| Verified link creation and removal | `toggle` |
| External copy, preserved originals and managed link replacement | `external_migration` |
| Managed-only trash and every historical restore layout | `lifecycle` |
| Read generations, approved FIFO jobs and UI result identity | Native controller and worker |

## Ownership and compatibility

A managed ID is one safe component, including older non-UUID IDs. Manifest entries are nonempty relative paths without parent traversal. Metadata must agree with its containing bundle ID. Descendant symlink directories cannot authorize writes outside a selected root. A dangling leaf still exists for ownership and collision checks.

New ownership records live under `mods/<mod-id>/links/<instance-key>.json`. Instance keys derive from canonical game Mods roots. Each record binds its bundle, instance and exact live-to-managed file mapping. Disable verifies the actual symlink target before removal. Replacement files or foreign symlinks remain untouched and produce an issue. Removing one instance's record cannot affect another instance.

Read both legacy `modId` and migration-written `mod_id`. Validate version and ID. Legacy records have no instance identity, so unresolved claims remain on disk. Compatibility tests must construct genuine legacy state without a newer instance record masking the reader.

New trash accepts valid managed bundles only. It does not infer ownership from a filename prefix or shared folder. Restore still reads normal managed bundles, legacy external wrappers, mixed `metadata/` wrappers and single files. Every destination is checked before any move. Mixed restores include their managed metadata.

## Recovery and writes

Both apps serialize writes through one core lock. Nested operation helpers share that authority rather than acquiring conflicting locks. Multi-step operations record their intended paths and phases before side effects. Recovery verifies ownership and current disk state before continuing or rolling back. Changed or ambiguous user paths remain intact with an actionable issue.

Folder imports publish a complete staged bundle. ZIP preflight rejects duplicate normalized paths, links, special files, escaping paths and occupied files. Contents stream with limits of 100,000 entries, 2 GiB per entry and 8 GiB expanded total. RAR/7z remains unsupported until extraction can enforce equivalent checks.

Migration preserves each original file or symlink object before installing a managed link. Outside symlink targets are read-only sources. Failure restores preserved originals only to unoccupied paths. Cross-device trash and restore verify copied contents before retiring the original location into a recovery holding. No transfer may permanently discard the only original or overwrite a new user file.

Metadata, ownership and recovery records use atomic replacement. Failed unlink cannot report success or discard ownership bookkeeping. Core recovery must run before further mutations; native startup also reports outstanding recovery issues.

## Native and retained React behavior

The scan mailbox can coalesce reads. Approved mutations use a separate FIFO and carry operation ID, game root and entry identity. Window close cannot silently drop approved jobs. Progress and final issues remain associated with the operation even after navigation. Stale scans, lookups and metadata results cannot replace another instance's catalog or selected mod.

Enable/disable shows its paths and warnings before approval. Migration reviews the exact external file set. Trash and source attachment require explicit confirmation. Candidates contain real provider data; weak confidence remains visible. The existing photos, `No Preview` fallback and requests without a Referer remain part of the UI contract.

After writes, refreshed scan data supplies enabled state and file membership. Metadata edits cannot overwrite these facts. The retained React app also needs scan generation guards, partial-batch reconciliation, handled errors, recoverable import forms, orphan issue reconciliation, system-theme updates and timed success feedback.

## Settings and release

Native settings persist locally with restricted permissions and atomic writes. CLI overrides apply to the launch without silently replacing saved preferences. Transfer is explicit local JSON:

```text
{version: 1, theme: "light" | "dark" | "system", gameRoots: string[],
 selectedRoot?: string, curseforgeApiKey?: string}
```

Normal export omits the key. Including it requires an explicit choice. Import validates and previews settings before confirmation. Custom browser themes retain their separate export format; this transfer format does not claim to reproduce them. Keys never enter mod metadata, operation records, logs or diagnostics.

The Linux archive includes the executable, desktop entry, icon and dependency license inventory. Its verifier extracts and runs the packaged executable against temporary fixtures. CI covers native tests, clippy, release fixture checks and packaging alongside existing validation.

## Verification status

This document specifies the implementation contract, not completed safety claims. Eight ownership regressions reproduced current defects before implementation. Four lifecycle regressions cover unmanaged removal, mixed metadata restore, collision preflight and cross-device transfer; their failing baseline still needs recording. The source fallback fix has 16 passing targeted tests. ZIP safety and Linux package verification have executable checks. Full workflow, interruption, desktop and comparative performance evidence will be recorded in the migration decision trail as implementation completes.

Physical touchpad, multiple-monitor and screen-reader checks need the relevant hardware/session. Fixture timings and compilation success cannot substitute for them.
