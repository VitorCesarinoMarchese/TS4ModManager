# TS4 Mod Manager

## Project Overview

TS4 Mod Manager is a Linux-first desktop mod manager for The Sims 4. It is built for players who run the game through Proton, Steam, or native-compatible Linux paths and want a safer way to inspect, organize, enable, and disable mods.

The Sims 4 mod folders can become difficult to manage over time, especially when mixing `.package` files, `.ts4script` files, folders, archives, and manually copied content. This project focuses on making that workflow clearer without hiding what happens on disk.

The project follows three core principles:

- Linux-first: Proton and Linux filesystem layouts are treated as first-class use cases.
- Local-first: mod state and filesystem operations are handled locally.
- Safe filesystem management: operations are designed to be inspectable and non-destructive where possible.

## Features

Implemented features include:

- Desktop application built with React, TypeScript, Tauri, and Rust.
- Linux and Proton Sims 4 path detection.
- Mod scanning for `.package` and `.ts4script` files.
- Filtering that hides folders and files that do not contain Sims 4 mod files.
- Mod grouping by folder or filename prefix.
- Enable and disable workflow using symlinks.
- Dry-run toggle checks before filesystem changes are applied.
- Detection and reporting of orphaned symlinks.
- Import panel for local mod archives.
- Mod details modal with rename flow.
- Search and filtering across mod names and files.
- Paginated mod grid with 12, 24, and 48 item page sizes.
- Dark mode with first-launch system theme detection.
- Persisted user theme preference.
- TailwindCSS UI with green accent color `#10b981`.
- Phosphor Icons throughout the interface.
- Framer Motion animations for cards, modals, and scan feedback.
- Scan loading overlay with disabled rescan state and animated feedback.
- Zustand-based frontend state management.
- Vitest and Rust test coverage for frontend and backend behavior.

## How It Works

### Mod scanning

The backend scans the selected Sims 4 `Mods` directory recursively. It only returns mod groups that contain at least one supported Sims 4 mod file:

- `.package`
- `.ts4script`

Supporting assets such as previews or documentation can still appear inside a returned group, but folders with no real mod files are excluded from the mod list.

### Proton path detection

The Rust backend detects common Linux and Proton Sims 4 locations, including Steam compatibility data paths. Custom game paths can also be validated and added from the settings modal.

### Grouping mods

Mods are grouped using a predictable strategy:

- Files inside a folder are grouped by that folder.
- Root-level files are grouped by filename prefix.

This keeps related files together while still supporting common loose-file mod layouts.

### Enable and disable strategy

The manager uses symlinks for enable and disable operations. Managed mod files can be linked into the game `Mods` directory without copying the full content repeatedly.

Before applying changes, the backend performs a dry run to list intended operations and detect blocking issues such as path collisions.

### Non-destructive filesystem operations

The backend is designed to avoid unsafe filesystem changes:

- Dry-run results are produced before applying toggles.
- Existing non-manager-owned files are not silently overwritten.
- Disabling removes only manager-owned links.
- Orphaned symlinks are detected and reported rather than deleted automatically.
- External mod migration is handled explicitly instead of editing external links in place.

## Technology Stack

- React: renders the desktop UI and component structure.
- TypeScript: provides type safety for frontend state, props, and API contracts.
- Tauri: packages the web UI as a lightweight desktop application.
- Rust: implements filesystem scanning, path detection, archive import, symlink handling, and safety checks.
- Zustand: manages frontend application state such as selected instance, mods, issues, and scan status.
- TailwindCSS: provides utility-first styling and theme consistency.
- Framer Motion: adds minimal functional animations for loading states, cards, and modals.

## Development Philosophy

This project uses a TDD-first workflow. Tests are written or updated before behavior changes, especially around filesystem safety, UI state, and user interactions.

The main development goals are:

- Keep filesystem operations explicit and testable.
- Prefer small, incremental changes over large rewrites.
- Preserve user data and avoid destructive defaults.
- Keep UI behavior covered by tests.
- Keep backend logic focused and independently testable.

Current validation status:

```text
npm run test:run       -> 71 passed
npm run build          -> passing
npm run test:coverage  -> 91.09%
cargo test             -> 44 passed
cargo check --features tauri-app -> passing
```

## Running the Project

### Prerequisites

Linux development environment:

- Node.js 22 or newer
- npm
- Rust stable toolchain
- Cargo
- Tauri Linux system dependencies

On Ubuntu-based systems, install the native Tauri dependencies with:

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

Install frontend dependencies:

```bash
npm ci
```

Run the frontend development server:

```bash
npm run dev
```

Run frontend tests:

```bash
npm run test:run
```

Run frontend coverage:

```bash
npm run test:coverage
```

Run Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Check the Tauri-enabled Rust build:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --features tauri-app
```

Build the frontend:

```bash
npm run build
```

## Building

Create a production frontend build:

```bash
npm run build
```

Create a release Rust binary with the Tauri application feature enabled:

```bash
cargo build --manifest-path src-tauri/Cargo.toml --features tauri-app --release
```

The release binary is written under:

```text
src-tauri/target/release/
```

If you use the Tauri CLI in your environment, you can also produce platform bundles with:

```bash
npx tauri build
```

## Project Structure

```text
.github/workflows/ci.yml       CI workflow for frontend and backend checks
src/                           React and TypeScript frontend
src/components/                UI components and component tests
src/lib/                       Frontend API wrappers, types, utilities, tests
src/store/                     Zustand app store and store tests
src-tauri/                     Rust backend and Tauri configuration
src-tauri/src/                 Filesystem, scanning, import, toggle, and path logic
tailwind.config.ts             Tailwind configuration and accent color
vite.config.ts                 Vite and Vitest configuration
package.json                   Frontend scripts and dependencies
src-tauri/Cargo.toml           Rust dependencies, features, and build targets
```

Important frontend files:

- `src/App.tsx`: main application shell, theme handling, scan overlay, modals.
- `src/components/ModGrid.tsx`: search results, pagination, and mod card rendering.
- `src/components/ModCard.tsx`: individual mod card UI.
- `src/components/ModScanOverlay.tsx`: scan loading overlay.
- `src/lib/pagination.ts`: pagination calculations.
- `src/store/appStore.ts`: frontend state and async actions.

Important backend files:

- `src-tauri/src/mod_scan.rs`: recursive mod scanning and grouping.
- `src-tauri/src/path_detection.rs`: Linux, Steam, and Proton path detection.
- `src-tauri/src/toggle.rs`: dry-run and symlink enable/disable logic.
- `src-tauri/src/orphan.rs`: orphan symlink detection.
- `src-tauri/src/archive_import.rs`: archive import handling.
- `src-tauri/src/tauri_commands.rs`: Tauri command bridge.

## Future Plans

Planned areas for future work:

- CurseForge integration.
- Metadata providers.
- Mod downloading.
- Conflict detection.
- Profiles.
- Dependency management.

These are not currently implemented.

## Contributing

Issues and contributions are welcome. Good contributions for this project are focused, tested, and careful around filesystem behavior.

Before opening a pull request, run:

```bash
npm run test:run
npm run test:coverage
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml --features tauri-app
```

When adding behavior, prefer tests first and keep changes small enough to review safely.
