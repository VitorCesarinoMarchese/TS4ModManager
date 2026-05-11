# TS4 Mod Manager

Linux-first desktop mod manager for **The Sims 4**. Built with React, TypeScript, Tauri, and Rust.

The app focuses on local, inspectable, safe filesystem management: scan your Sims 4 `Mods` folder, identify installed mods, attach metadata, manage display names/source URLs, move mods to trash, restore trashed mods, and optionally migrate existing installed mods into manager-owned storage.

## Current State

Phase 2 is complete: metadata, themes, game instance UX, safe lifecycle management, and Linux desktop hardening are implemented.

Current validation baseline:

```text
npm run test:coverage  -> 120 frontend tests, branch coverage 80.15%
cargo test             -> 70 Rust tests
npm run build          -> passing
cargo check --features tauri-app -> passing
```

## Core Principles

- **Linux-first**: native Linux paths, Steam/Proton paths, Flatpak Steam paths, Wayland workarounds.
- **Local-first**: no cloud account, no remote database, no direct web downloads.
- **Safe by default**: no permanent deletion; uninstall moves files to trash.
- **Inspectable filesystem behavior**: manager-owned content lives under `~/.local/share/sims4-mod-manager`.
- **TDD-first development**: frontend and Rust behavior covered by tests.

## Features

### Game instance detection

The backend detects common Sims 4 locations:

- Native Linux-style path:
  - `~/Documents/Electronic Arts/The Sims 4`
- Steam/Proton compatdata paths, including Steam library folders.
- Flatpak Steam paths.
- Custom Sims 4 root paths from Settings.

A custom path must point to the **Sims 4 root folder that contains `Mods/`**, not the `Mods` folder itself.

### Mod scanning

The scanner recursively reads the selected game instance `Mods` folder and returns groups that contain Sims 4 mod files:

- `.package`
- `.ts4script`

Grouping rules:

- Files inside a folder are grouped by that folder.
- Root-level loose files are grouped by filename prefix.
- Preview assets can be shown when present.
- Non-mod folders/files are filtered out.

Existing local files in `Mods/` scan as **external** until migrated into manager storage.

### Managed storage

Manager-owned mods live in:

```text
~/.local/share/sims4-mod-manager/mods
```

Each managed mod stores metadata in its own `meta.json`.

Stored metadata includes:

- detected display name
- custom display name
- source URL
- provider/source type
- preview metadata fields
- file manifest

### Metadata and source URLs

Implemented metadata support:

- Local filename/folder name detection.
- Known aliases, e.g. MCCC/WickedWhims-style names.
- Editable display names persisted to `meta.json`.
- Source URL attach/remove flow.
- Provider detection for CurseForge and ModTheSims URLs.
- Browser/external open for source URLs.

Provider architecture exists for:

- Local name provider
- CurseForge provider abstraction
- ModTheSims URL-based provider abstraction

No direct web downloads are implemented.

### Enable/disable and migration

Manager-owned mods use symlinks into the game `Mods` folder.

Safety behavior:

- Dry run before toggle apply.
- Path collisions block enable.
- Disabling removes only manager-created symlinks.
- Unmanaged files are never overwritten or deleted silently.
- Orphan symlinks are reported, not auto-deleted.

External installed mods can be migrated with **Manage this mod**:

1. Copy current installed files into manager storage.
2. Write metadata/manifest.
3. Replace live installed files with manager-owned symlinks.

### Import

Local archive import is implemented for supported archive flows. Imported mods are copied into manager storage and then can be enabled via symlinks.

### Safe uninstall and trash

Uninstall behavior:

- Requires confirmation.
- Removes manager-created symlinks when present.
- Moves managed storage and/or installed files to trash.
- Does **not** permanently delete user files.
- Does **not** delete unmanaged files.

Trash behavior:

- Files move to Freedesktop trash layout:
  - `$XDG_DATA_HOME/Trash/files`
  - fallback: `~/.local/share/Trash/files`
- `.trashinfo` files are written under `Trash/info`.
- Settings includes a trash manager:
  - refresh trash list
  - restore trash entry

### Settings and folders

Settings includes buttons to open:

- managed mod folder: `~/.local/share/sims4-mod-manager/mods`
- manager folder: `~/.local/share/sims4-mod-manager`

Folder opening uses `xdg-open` with detached stdio and Linux desktop env workarounds.

### Themes

Theme system supports:

- Light
- Dark
- System
- multiple custom themes
- editable colors
- theme rename
- JSON import/export
- reset current custom theme
- CSS variables applied broadly across app surfaces, controls, cards, borders, and modals

Custom theme fields:

```ts
type AppTheme = {
  name: string;
  colors: {
    accent: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
  };
};
```

Default accent: `#10b981`.

### UI

Implemented UI includes:

- top bar
- settings modal
- game instance sidebar, hidden by default, user-expandable
- search bar
- mod grid
- pagination: 12 / 24 / 48
- mod details modal
- issues panel
- popup error warning dialog
- success toast
- scan loading overlay
- custom themed dropdowns

## Linux Desktop Notes

Some Wayland/WebKitGTK systems can crash with:

```text
Error 71 (Protocol error) dispatching to Wayland display
```

The app applies this runtime workaround by default:

```text
WEBKIT_DISABLE_DMABUF_RENDERER=1
```

To opt out:

```bash
TS4MM_DISABLE_WAYLAND_WORKAROUNDS=1 ./ts4-mod-manager
```

Folder/source opening also runs `xdg-open` with:

```text
NO_AT_BRIDGE=1
WEBKIT_DISABLE_DMABUF_RENDERER=1
```

## Running From Source

### Prerequisites

- Node.js 22+
- npm
- Rust stable
- Cargo
- Tauri Linux dependencies

Ubuntu/Debian example:

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  file \
  libayatana-appindicator3-dev \
  libglib2.0-dev \
  librsvg2-dev \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  patchelf \
  pkg-config \
  wget
```

Install dependencies:

```bash
npm ci
```

Frontend dev server:

```bash
npm run dev
```

Run frontend tests:

```bash
npm run test:run
```

Run coverage:

```bash
npm run test:coverage
```

Run Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Check Tauri-enabled Rust build:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --features tauri-app
```

Build frontend:

```bash
npm run build
```

Build release binary:

```bash
cargo build --manifest-path src-tauri/Cargo.toml --features tauri-app --release
```

Release binary:

```text
src-tauri/target/release/ts4-mod-manager
```

## Packaging

Tauri bundling is enabled for Linux AppImage and deb targets.

Build local release bundles:

```bash
npm ci
npx tauri build
```

Expected bundle outputs:

```text
src-tauri/target/release/bundle/appimage/
src-tauri/target/release/bundle/deb/
```

The package metadata lives in:

```text
src-tauri/tauri.conf.json
```

Current Linux bundle settings:

- targets: `appimage`, `deb`
- icon: `src-tauri/icons/icon.png`
- category: `Utility`

If WebKitGTK/Wayland crashes on a target machine, run the binary with the default workaround enabled, or explicitly set:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./ts4-mod-manager
```

## Project Structure

```text
.github/workflows/ci.yml       CI workflow
plan.md                        phase plan and current notes
src/                           React/TypeScript frontend
src/components/                UI components and tests
src/lib/                       frontend APIs, types, metadata/theme utilities
src/store/                     Zustand app store and tests
src-tauri/                     Rust backend and Tauri config
src-tauri/src/archive_import.rs
src-tauri/src/commands.rs
src-tauri/src/external_migration.rs
src-tauri/src/lifecycle.rs
src-tauri/src/managed_storage.rs
src-tauri/src/metadata_names.rs
src-tauri/src/mod_scan.rs
src-tauri/src/path_detection.rs
src-tauri/src/runtime_env.rs
src-tauri/src/runtime_paths.rs
src-tauri/src/tauri_commands.rs
src-tauri/src/toggle.rs
```

## Safety Guarantees

The intended safety rules are:

- No permanent deletion from app uninstall flow.
- Do not remove unmanaged files.
- Disable removes only manager-owned symlinks.
- Path collision blocks enable.
- External metadata/provider failures do not block local mod management.
- Restore checks for collisions before moving files back.

## Not Implemented Yet

- Direct CurseForge/ModTheSims downloads.
- Broad web crawling.
- Mod dependency resolution.
- Conflict scanner beyond duplicate/path collision basics.
- Profiles/loadout switching.
- Full trash empty/prune workflow.

## Which Custom Sims 4 Path Should I Add?

Add the folder that contains `Mods/`.

Examples:

Native-style install:

```text
/home/YOUR_USER/Documents/Electronic Arts/The Sims 4
```

Steam/Proton install usually looks like:

```text
/home/YOUR_USER/.steam/steam/steamapps/compatdata/1222670/pfx/drive_c/users/steamuser/Documents/Electronic Arts/The Sims 4
```

or:

```text
/home/YOUR_USER/.local/share/Steam/steamapps/compatdata/1222670/pfx/drive_c/users/steamuser/Documents/Electronic Arts/The Sims 4
```

Flatpak Steam often looks like:

```text
/home/YOUR_USER/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata/1222670/pfx/drive_c/users/steamuser/Documents/Electronic Arts/The Sims 4
```

Do **not** add:

```text
.../The Sims 4/Mods
```

Add its parent instead:

```text
.../The Sims 4
```
