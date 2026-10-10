# Native migration completion report

Historical record from before the React/Tauri app was retired. Source paths and validation commands describe that revision. The current app lives in `native/`, with its Rust library in `core/`. See the [current setup instructions](development.md).


Validated on 2026-10-09. The Fastframe/egui executable now manages local mods through the shared Rust core. The React/Tauri interface remains available and received the state and error fixes. Photo thumbnails and larger detail previews remain in the native interface.

## Delivered work

| Workstream | Result and evidence |
| --- | --- |
| Shared core design | Per-instance ownership records, contained filesystem writes and a process-wide writer lock. [Safety contracts](native-management-design.md). |
| Filesystem safety and recovery | Journaled import publication, migration, toggle, trash and restore. Collision preflight, dangling-link handling and preserved cross-device originals. Ownership tests (`src-tauri/tests/ownership.rs` at the recorded revision), lifecycle tests (`src-tauri/tests/lifecycle_safety.rs` at the recorded revision), recovery tests (`src-tauri/tests/recovery_safety.rs` at the recorded revision). |
| Source isolation and retained frontend | Fabricated fallback candidates removed. Scan generations, metadata reconciliation, partial batch refresh, handled failures, reviewed toggles, recoverable forms, theme updates and timed feedback. Store regressions (`src/store/appStore.regression.test.ts` at the recorded revision), UI regressions (`src/App.regression.test.tsx` at the recorded revision). |
| Native controller | Approved jobs run through a FIFO worker. Results keep their original operation identity; shared writes refresh the current catalog. Startup recovery has visible waiting status and prevents blocking window shutdown. [Controller](../native/src/controls.rs), [worker](../native/src/management.rs). |
| Native management UI | Folder/ZIP import, reviewed enable/disable and external migration, rename, explicitly confirmed source changes, managed-only trash and reviewed restore. [Executable workflow verifier](../native/src/workflows.rs). |
| Settings transfer | Local persisted settings, versioned transfer, preview before import, bounded reads and existing-file export protection. Keys omitted by default; omitted imports preserve the local key. [Native settings](../native/src/settings.rs), frontend transfer (`src/lib/settingsTransfer.ts` at the recorded revision). |
| Packaging and release verification | Linux archive with executable, desktop entry, icon and license inventory. CI includes release catalog and management checks. The extracted packaged executable passed locally. [Package verifier](../native/verify_package.py), [CI](../.github/workflows/ci.yml). |

All implementation units have signed commits. The final functional revisions are `48de19c`, `fb7f75a` and `02a478a`; package verification is `2341ca6`. Their signatures were verified locally. CI configuration is committed; a remote CI run was not performed in this session.

## Validation

| Check | Result |
| --- | --- |
| `npm run test:coverage` | 213 tests across 25 files; 89.74% statements/lines, 83.74% branches and 96.39% functions. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 164 normal tests passed, plus the separately invoked process-lock child. Three entries ignored: two legacy fake shell helpers and that child fixture. |
| `npm run build` | Passed. |
| `cargo check --manifest-path src-tauri/Cargo.toml --features tauri-app` | Passed. |
| Native tests and clippy | 33 tests passed; all-target clippy with warnings denied passed. |
| Release builds | Both native and Tauri release executables built with locked dependencies. |
| `--verify-workflows` | 18 operations, ten named checks, three resulting managed mods; fixture paths only. Original and managed bytes preserved. |
| `native/verify.py` | 100, 1,000 and 10,000 groups; Unicode and filename search, invalid-path failure and unchanged inputs passed. |
| Native rendering | Real light, dark and narrow screenshots captured on the Linux desktop; preview-pixel assertions passed. Wide and narrow layouts inspected. |
| `native/verify_package.py` | Extracted executable, assets, license inventory, catalog and management workflows passed. |
| Benchmark sampler regression | Passed. |

The workflow verifier uses the production controller and worker. It does not simulate every physical click. An egui pointer test separately proves source metadata is absent before confirmation and written after the actual confirmation button receives a click. No tests or benchmarks operated on the user's mod collection.

Durable local evidence is in `/home/tept/Projects/.TS4ModManager-migration/reports/`: `root-core-final.log`, `root-native-final.log`, `root-coverage-final.log`, `root-build-final.log`, `root-tauri-check-final.log`, `root-native-clippy-final.log`, `root-workflows-final.json`, `root-catalog-final.jsonl`, `root-package-final.log` and `final-captures/`. Historical `/tmp` baselines were removed between sessions. The decision trail preserves that gap; these current runs supersede the old green checks but cannot recreate lost historical failing outputs.

## Release measurements

These measurements and hashes identify the migration build before the later photo-card redesign in `2e4fe03`. The local archive path is reused when packaging a newer build; verify its current hash directly rather than comparing that newer archive with the historical hashes below.

The committed [benchmark script](../native/benchmark.py) launched each current release three times on the same Hyprland desktop, with separate temporary homes and 1,000 synthetic mod groups per launch. Memory covers the process tree two seconds after window mapping. PSS apportions shared pages. Window mapping measures appearance, not a completed catalog frame or input-to-paint latency.

| Metric | Native | React/Tauri |
| --- | ---: | ---: |
| Median window mapping | 153 ms | 173 ms |
| Median settled PSS | 59.7 MiB | 208.2 MiB |
| Settled process count | 1 | 3 |

Native used about 71% less proportional memory in these fixtures. Three sequential launches are a small sample; caches were not flushed and execution order was fixed. The window timings show a modest difference, not proof of a universal startup improvement. Raw samples and executable hashes are in `reports/window-final-1000.json`.

| Native catalog size | Scan | Search |
| --- | ---: | ---: |
| 100 | 1.06 ms | 0.002 ms |
| 1,000 | 10.68 ms | 0.013 ms |
| 10,000 | 53.17 ms | 0.081 ms |

These are single-run scan/filter measurements from the actual release executable. Search timing excludes painting. Visible catalog and file rows are virtualized and tested, but GPU frame times and physical wheel/touchpad behavior were not measured. The benchmark does not establish the proposed p95 frame or input-to-paint targets.

The verified archive is `native/target/packages/ts4-mod-manager-native-0.1.0-linux-x86_64.tar.gz`. SHA-256:

```text
archive  510530991d544f047e25c61540daf1e837821442dee66d28d5aefab12be7d394
native   c5937cde9f5a17fd1da6309d0670f96f3e345fe41306dbc32505b127b5c3239a
Tauri    2f888336550b68fa22496544173f72e9086706ad1ae7c4a281415da79f1765a7
```

## Original bug inventory status

The [investigation](fastframe-investigation.md) describes the original revision. Its B01-B19 defects have repairs in the current tree:

| Original IDs | Repair and regression evidence |
| --- | --- |
| B01, B02, B08, B11, B12 | Shared ownership parsing, verified targets, dangling-link handling, journaled bookkeeping and instance records. Ownership and recovery tests. |
| B03 | Missing API key returns an error; no invented provider fallback. Source lookup tests. |
| B04 | Managed identity splits shared-folder groups; relative links retain ownership. Scanner tests. |
| B05, B06, B07, B13, B14, B17 | Reconcile after writes, preserve scan facts during metadata edits, reject stale scans/errors, refresh partial batches and replace scan issues. Store tests. |
| B09, B10 | Verified cross-device transfer and complete metadata restore with all-destination preflight. Lifecycle and recovery tests. |
| B15, B16, B18, B19 | Reset blocked toggle state after scans, retain failed form input, prevent duplicate submissions, update system theme and expire feedback. Component/UI tests. |

Further safety concerns from that investigation also received fixes: transactional publication and rollback, boundary path validation, explicit toggle review and managed-only removal. The following product gaps and verification limits remain outside the completed local management scope.

## Remaining limits

- Cross-device holdings, migration originals and recovery copies remain on disk. Automatic pruning is disabled so original bytes are retained; this costs disk space.
- Journal checksums detect accidental corruption. They do not protect against deliberate same-user rewriting. The shared lock coordinates these apps, not unrelated tools racing to replace filesystem leaves.
- Ambiguous recovery preserves changed paths and reports an issue. It can require manual attention before later writes. Injected failures and reconstructed process state are tested; actual OS kill/reboot interruption was not exercised.
- Some nested scan read errors are still suppressed. A successful catalog scan does not prove all nested files were readable.
- Live provider behavior was not retested. Exact/fuzzy provider fingerprint matching and bulk source review remain future work. Provider lookup can make serial requests without an explicit overall deadline; native lookup uses the same FIFO worker, so a long lookup can delay queued writes.
- Browser custom color themes use their own export; native settings transfer supports built-in light/dark/system themes. Candidate review is text-only; mod photos remain supported.
- RAR/7z import is disabled. The local ZIP path has bounds and containment checks. Mod downloads and updates remain excluded under project rules.
- Profiles, dependency resolution and deeper Sims package conflicts remain future product work. Native Linux is the verified platform; Windows/macOS, a separate X11 run, HiDPI/multiple monitors, screen readers and physical touchpads were not verified.
- The retained browser UI requires Tauri IPC for filesystem work. Its standalone Vite preview cannot verify the backend. The native app is ready for local acceptance testing, but the legacy interface has not been retired.

A fresh gpt-6.1-sol reviewer on the Personal Codex account confirmed the earlier export and refresh fixes and found the startup-close issue, which now has a failing-before regression and fix. This was a same-family review to honor the user's account restriction. The durable audit is `reports/final-audit.md`. No Claude or Work-account model was used for resumed work.
