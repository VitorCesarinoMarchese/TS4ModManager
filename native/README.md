# Native catalog pilot

This is the first Fastframe/egui UI for TS4 Mod Manager. It uses the existing Rust core to detect game folders, scan mods, search names and filenames, and show saved source details and file lists. Catalog and file lists render only visible rows. Filesystem work runs on one background worker; obsolete scan results are ignored.

The pilot is read-only. Import, enable/disable, migration, source attachment, trash/restore, preview loading, settings migration, and packaging remain future migration work. The existing React/Tauri app remains available.

Requires Rust 1.98 or later and native Linux graphics support. Fastframe is pinned to `bb79dbddef01e660f9cfc37ccd9dff1c299a8d47`. `Cargo.lock` pins the resolved dependencies, including egui/eframe 0.36.2. This pilot uses published egui/winit rather than the optional Fastframe forks.

Run from the project root:

```bash
cargo run --manifest-path native/Cargo.toml --locked
```

Open a custom game folder, the directory containing `Mods`:

```bash
cargo run --manifest-path native/Cargo.toml --locked -- \
  --root '/path/to/The Sims 4'
```

The window follows the desktop theme, with a light/dark switch. Select Change folder to choose another detected game folder or enter a path and select Open. Search works over display names and filenames. Select a row to inspect files and saved source metadata. On narrow windows, details replace the catalog and offer Back to mods. Copy copies the full file list and confirms with Copied. Files show their basename above the containing folder; truncated names have full-path tooltips.

The default managed root is `~/.local/share/sims4-mod-manager`. Scanning does not create it. Override it with `--managed-root PATH`. Use `--help` for all options. The scanner still suppresses some nested filesystem read errors; a successful scan is not proof that every nested path was readable.

Headless inspection uses the same scan and search model:

```bash
native/target/debug/ts4-mod-manager-native \
  --root '/path/to/The Sims 4' --inspect --query 'filename'
```

Run tests and repeatable verification:

```bash
cargo test --manifest-path native/Cargo.toml --locked
cargo build --manifest-path native/Cargo.toml --locked
python native/verify.py
```

`verify.py` creates temporary catalogs of 100, 1,000, and 10,000 mod groups, exercises the actual binary, checks Unicode/filename search and invalid paths, and verifies that input bytes and paths remain unchanged. It reports scan/search timings. For native screenshots, run this from a graphical desktop:

```bash
python native/verify.py --sizes 100 --capture-dir /tmp/ts4-native-captures
```

This captures real light, dark, and narrow windows. Screenshot mode fixes the window size and quits after writing the PNG. Normal launches remain resizable. For release measurements, build with `cargo build --manifest-path native/Cargo.toml --release --locked` and pass `--binary native/target/release/ts4-mod-manager-native` to the script.

Initial debug verification on this workspace measured about 137 ms to scan 10,000 synthetic external mod groups and about 1 ms to filter them. These are single-run fixture timings, not release benchmarks or a comparison with Tauri. Startup, resident memory, frame times, real touchpad behavior, and production mod collections still need measurement before choosing a full rewrite.

The scanner ownership fix and native controller use failing-before regression tests. Scanner tests prove managed mods stay separate when they share a folder with each other or external files, and relative managed links report installed state. Native tests cover stale success/error rejection, stable identities, same-instance refresh, Unicode/filename search, pending-request replacement, unchanged temporary inputs, CLI validation, and actual egui search interaction and virtualized rendering.

See [the investigation](../docs/fastframe-investigation.md) for the original bug inventory and [the chosen design](../docs/native-pilot-design.md) for the controller rationale. The inventory describes the pre-pilot revision. This work fixes shared-folder scan identity and supplies scan enabled state; it does not fix the other lifecycle or source-lookup defects.

Folder and file icons are vendored from [Lucide](https://github.com/lucide-icons/lucide/tree/main/icons), with white strokes for Fastframe tinting. Their license is included in `licenses/Lucide-LICENSE.txt`.
