# Native mod manager

The Fastframe/egui UI uses the existing Rust core to detect game folders, scan mods, search names and filenames, and manage local mods. Photo cards are the default library view; the card/list switch offers compact rows. Cards, catalog rows and file lists render only visible rows. A replaceable reader handles scans. A separate FIFO worker retains approved management operations and reports their queued, running, and finished states.

Import folder is the primary action in the management bar. Import ZIP, Restore from trash, and Settings sit beside it. Select a managed mod for direct Enable/Disable controls. More actions contains rename, source lookup/attachment/removal and trash. Select an external mod to review its files before migration. The existing React/Tauri app remains available.

Requires Rust 1.98 or later and native Linux graphics support. Fastframe is pinned to `bb79dbddef01e660f9cfc37ccd9dff1c299a8d47`. `Cargo.lock` pins the resolved dependencies, including egui/eframe 0.36.2. The native app uses published egui/winit rather than the optional Fastframe forks.

Run from the project root:

```bash
cargo run --manifest-path native/Cargo.toml --locked
```

Open a custom game folder, the directory containing `Mods`:

```bash
cargo run --manifest-path native/Cargo.toml --locked -- \
  --root '/path/to/The Sims 4'
```

The window follows the desktop theme, with a light/dark switch. Select Change folder to choose another detected game folder or enter a path and select Open. Search works over display names and filenames. The library shows large photo cards by default, and details show a larger preview. All, Installed and Stored navigation filters intersect the current name/filename search. Filter counts come from the actual catalog. Changing a filter does not mutate files. Switching between cards and list rows preserves search and selected identity. Saved local PNG/JPEG/WebP/GIF images and HTTP(S) URLs load in the background without a Referer header. Missing, broken, and unsupported previews show No Preview. Preview loading writes no preview files. Source attachment and removal require explicit confirmation. Select a card or row to inspect files and saved source metadata. Wide windows have a navigation rail and persistent inspector. Below 1040 logical points, state tabs replace the rail; selected details replace the catalog and offer Back to mods. Copy copies the full file list and confirms with Copied. Files show their basename above the containing folder; truncated names have full-path tooltips.

The default managed root is `~/.local/share/sims4-mod-manager`. Scanning does not create it. Override it with `--managed-root PATH`. Use `--help` for all options. The scanner still suppresses some nested filesystem read errors; a successful scan is not proof that every nested path was readable.

Headless inspection uses the same scan and search model:

```bash
native/target/debug/ts4-mod-manager-native \
  --root '/path/to/The Sims 4' --inspect --query 'filename'
```

Enable and disable first show their exact paths and warnings. Confirmation revalidates the approved review. Migration shows the external file set. Trash accepts managed mods and requires confirmation. Restore lists recoverable entries and requires a destination review. An approved operation remains associated with its original root and entry after navigation. Closing the window waits for approved operations to finish.

Find source uses real CurseForge provider results and reports a missing API key. Candidates show confidence, reasons, and evidence. Low-confidence warnings stay visible in attachment review. Manual URLs carry no verified-match claim. The native app does not download or update mods.

Startup asks the core to recover pending operations and displays recovery issues. Native toggle and migration hold the shared writer guard across revalidation and mutation. A forced process termination can interrupt approved work; core recovery preserves changed or ambiguous user paths and may require attention before further mutations. OS kill, reboot, touchpad, monitor, and screen-reader checks still need separate evidence.

Settings save locally in `~/.config/ts4-mod-manager/settings.json` using atomic replacement and mode 0600 on Unix. Save local settings persists the theme, remembered game folders, selected folder, and optional API key. CLI overrides apply to that launch. Export requires an unused file path and omits the API key unless Include API key in export is checked. Import reads at most 1 MiB, validates and previews version 1 JSON before confirmation, and preserves the existing API key when the transfer omits it. Keys stay outside mod metadata and operation history.

Run tests and repeatable verification:

```bash
cargo test --manifest-path native/Cargo.toml --locked
cargo build --manifest-path native/Cargo.toml --locked
python native/verify.py
native/target/debug/ts4-mod-manager-native --verify-workflows
```

`--verify-workflows` creates its own temporary fixtures and uses the same native controller and management worker as the UI. It verifies folder and ZIP imports, reviewed enable and disable in two instances, migration, rename, manual source changes, trash and restore, missing-key errors, refreshed catalog data, and byte preservation. It prints a JSON report and ignores user paths for its fixtures.

`verify.py` creates temporary catalogs of 100, 1,000, and 10,000 mod groups, exercises the actual binary, checks Unicode/filename search and invalid paths, and verifies that input bytes and paths remain unchanged. It reports scan/search timings. For native screenshots, run this from a graphical desktop:

```bash
python native/verify.py --sizes 100 --capture-dir native/target/captures
```

This captures real light, dark, and narrow windows. Screenshot mode fixes the window size and quits after writing the PNG. Normal launches remain resizable. For release measurements, build with `cargo build --manifest-path native/Cargo.toml --release --locked` and pass `--binary native/target/release/ts4-mod-manager-native` to the script.

The pre-redesign migration build scanned 10,000 synthetic groups in 53 ms. On 1,000-group fixtures, three launches used median process-tree PSS of 60 MiB for native and 208 MiB for the compared Tauri release. Median window mapping was 153 ms and 173 ms. These historical fixture measurements exclude input-to-paint latency and GPU frame times; they were not repeated for the library redesign. See the [completion report](../docs/native-migration-report.md) for raw evidence, method and remaining desktop checks.

Compare release executables on a running Hyprland desktop without opening real game data:

```bash
python3 native/benchmark.py --native native/target/release/ts4-mod-manager-native \
  --tauri src-tauri/target/release/ts4-mod-manager --mods 1000 --runs 3 \
  --output native/target/benchmark.json
```

Build a Linux release archive with a desktop entry, icon and dependency license inventory:

```bash
python3 native/package.py
python3 native/verify_package.py --binary native/target/release/ts4-mod-manager-native
```

Archives are written under `native/target/packages`. Pass `--binary PATH` to package an existing build or `--output PATH` to choose another destination. Packaging does not install anything. The archive's README explains local installation. The executable uses the host OpenGL driver and X11 or Wayland libraries. The verifier extracts the archive and runs its actual executable against an isolated catalog. CI runs native tests, clippy, release fixture checks and package verification, then uploads the Linux archive.

The scanner ownership fix and native controller use failing-before regression tests. Scanner tests prove managed mods stay separate when they share a folder with each other or external files, and relative managed links report installed state. Native tests cover stale success/error rejection, stable identities, same-instance refresh, Unicode/filename search, pending-request replacement, unchanged temporary inputs, CLI validation, and actual egui search interaction and virtualized rendering.

See [the investigation](../docs/fastframe-investigation.md) for the original bug inventory and [the chosen design](../docs/native-pilot-design.md) for the original controller rationale. See [native management design](../docs/native-management-design.md) for the current safety contracts. The investigation inventory describes the earlier revision.

Navigation, layout, folder and file icons are vendored from [Lucide](https://github.com/lucide-icons/lucide/tree/main/icons), with white strokes for Fastframe tinting. Their license is included in `licenses/Lucide-LICENSE.txt`.

Preview caching retains at most 32 image URIs and resets on Rescan or a game-folder change. Local relative paths resolve inside that instance’s Mods folder. Browser-only blob/asset URLs and data URIs are unsupported. Detail previews preserve aspect ratio with contain sizing; cards and list thumbnails use centered cover crops that account for the destination proportions. The summary scrolls independently so Files and Copy remain reachable in short windows.

The reviewed library design and tokens are recorded in [DESIGN.md](DESIGN.md) and [the native design manifest](../.impeccable/design.json). The [surface brief](../.impeccable/surfaces/native-library.md) records the approved direction. This is a Linux egui UI; the HTML/CSS design detector does not apply.

Redesign validation passed 38 native tests, including destination-aware crop geometry, light-theme secondary-text contrast and pointer-driven More actions closure. Project validation passed 213 frontend tests, 164 Rust core tests, coverage, the frontend build and the Tauri app feature check. Native clippy, the release build and the packaged executable's 18-operation workflow check also passed. One existing localhost preview test timed out during parallel compilation; the complete native suite passed on the serial rerun and on a later normal parallel run with compilation idle. These checks do not certify untested hardware or screen-reader behavior.
