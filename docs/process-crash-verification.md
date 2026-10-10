# Process-crash recovery verification

On 2026-10-10, twelve process-crash scenarios passed using disposable fixtures. The parent sends real `SIGKILL` to a child executing the core filesystem functions, then starts another process to recover its pending transaction. No game collection, user settings, API key, or network access is involved.

## Run the check

Run from the repository root:

```bash
cargo test --manifest-path core/Cargo.toml --locked sigkill_recovers_import_migration_and_restore -- --nocapture
```

The check also runs in the normal core test suite and existing CI. Its [test harness](../core/src/operation_crash_tests.rs) pauses at completed, journaled filesystem side effects. Each child uses the actual import, migration, restore, and recovery implementations. The pause hook is compiled only into core test builds. Production executables do not accept these fixture environment variables.

Each wait has a ten-second timeout. Child processes are killed and reaped if an assertion fails. Temporary fixtures are removed after each case.

## Scenarios and assertions

| Operation | Kill points | Expected recovery |
| --- | --- | --- |
| Folder import | After publishing the managed bundle | Return the bundle to staging and leave the source bytes unchanged. |
| External migration | After bundle publication, original preservation, link creation, ownership-record write, and backup-index write | Restore the original symlink and outside target bytes. Retain bookkeeping copies outside the returned bundle. |
| Legacy trash restore | After restoring its file, retiring the wrapper, and retiring the trash index | Restore the original trash file, wrapper, and index. |
| Managed trash restore | After restoring the bundle and retiring the trash index | Return the complete managed bundle and index to trash. |
| External migration with a new user replacement | After preserving the original, before a new file appears at the original game path | Preserve the new user file and original backup, report an issue, and retain the journal for manual attention. |

The eleven unambiguous cases require a cleared journal and no published interrupted bundle. The replacement case requires a retained journal. All cases verify source bytes, unmanaged game files, symlink targets, trash file contents, and the outside symlink target. Recovery runs twice in the fresh process to check repeatability. Acquiring the writer lock in that process proves that `SIGKILL` released the dead writer's lock.

## Regression found and fixed

Before the fix, killing migration after its ownership-record write produced `Transfer content changed; preserving all paths`. The original game files were recoverable, but recovery left the newly published managed bundle and journal blocked.

Publication recorded a fingerprint before the `links` directory existed. Migration added that directory, and rollback retained its newly written ownership record inside the bundle. Both additions changed the fingerprint needed to move the bundle back to staging.

Imports now create the empty `links` directory before publication. Rollback moves new bookkeeping records to `managed_root/operations/.ts4-record-recovery-*`, outside the bundle. This retains the records and lets the bundle match its recorded fingerprint after rollback. No content comparison or user-replacement protection was relaxed.

The failing case passed after the fix, as did all twelve scenarios.

## Release validation

All eight required checks in the [development guide](development.md#validate-changes) passed after the fix, including core and native tests, native clippy, the release build, Python tests, catalog fixtures, management workflows, and the extracted package. The package filename uses `0.0.1-alpha.1`, and its project license matches the root MIT license. The release executable contains neither `TS4_CRASH_FIXTURE` nor `TS4_CRASH_AFTER`.

An additional core clippy run with `--all-targets -- -D warnings` reported four existing lint errors in untouched code: character matching in `metadata_names.rs`, iterator syntax in `path_detection.rs`, an unchecked socket read in the `curseforge_client.rs` test, and a function after the test module in `lifecycle.rs`. These remain pending. This extra check is broader than the repository's required native clippy command.

## Limits

This check kills core-operation test processes, rather than driving and killing the desktop window. It covers completed transaction side effects, not every instruction or a partially completed filesystem syscall. It does not simulate reboot, power loss, storage-controller caches, or interrupted cross-device copies. Those require separate evidence. Existing cross-device transfer tests remain part of the core suite.
