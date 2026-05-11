# Sims 4 Linux Mod Manager — Phase 2 Plan

## Phase Name

Metadata, themes, and safe lifecycle management

## Current State

Phase 2 checkpoints 1-11 are complete. Latest lifecycle hardening adds:

- Existing local Mods entries scan as external until managed.
- Move to Trash moves installed files/folders plus metadata, not metadata alone.
- Settings can open `sims4-mod-manager`, managed mods folder, list trash, and restore trash entries.
- External mods can be migrated into managed storage with live files replaced by manager symlinks.
- Folder opening detaches `xdg-open`, silences stdio, and applies Linux desktop env workarounds to avoid DBus/GLFW/Wayland noise.
- Tauri startup sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` by default to avoid common WebKitGTK Wayland protocol crashes; set `TS4MM_DISABLE_WAYLAND_WORKAROUNDS=1` to opt out.
- Uninstall/restore success feedback appears as a toast.
- Settings includes Manage All Mods for bulk external migration with loading feedback.
- Trash list filters out unrelated user trash and shows only mod/app-related entries.
- Trash entries parse `.trashinfo` and show original path plus deletion date when available.
- Settings modal and game instance sidebar have exit animations.
- Custom path entry hints that users must select `The Sims 4`, not `Mods`, and auto-submits the parent when `Mods` is entered.
- Settings can copy diagnostics for support, including selected instance, counts, runtime paths, Wayland workaround state, and recent issues.
- Tauri release bundling is enabled for Linux AppImage and deb targets, with README packaging instructions.

The project is a functional Linux-first Sims 4 mod manager with:

- React + TypeScript frontend
- Tauri desktop shell
- Rust backend commands
- Zustand store
- TailwindCSS styling
- Phosphor Icons
- Framer Motion animations
- System theme detection and persisted theme preference
- Green accent color `#10b981`
- Scan loading overlay and animated rescan feedback
- Mod grid search, filtering, and pagination
- Linux/Proton Sims 4 path detection
- Non-mod filtering for scanned content
- Safe symlink-based enable/disable behavior
- TDD workflow with passing frontend and Rust tests

Current validation baseline:

```text
npm run test:coverage  -> 131 frontend tests, branch coverage 80.57%
npm run build          -> passing
cargo test             -> 73 passed
cargo check --features tauri-app -> passing
```

## Phase 2 Goals

1. Add metadata provider architecture for CurseForge and ModTheSims.
2. Support browser fallback links for source pages.
3. Detect official mod names from local filenames and folders.
4. Fetch metadata and images when possible.
5. Store editable display names in each managed mod `meta.json`.
6. Add a custom theme editor with JSON import/export.
7. Improve game instance sidebar behavior.
8. Add safe uninstall by moving managed mods to trash.
9. Remove emoji from issue empty state.
10. Keep strict test-first workflow.

## Constraints

- Tests must be written or updated before implementation.
- Keep commits small and atomic.
- Never permanently delete user files.
- Do not delete unmanaged files.
- Do not implement direct web downloads in Phase 2.
- Do not do broad web crawling.
- ModTheSims scraping must be URL-based only.
- External metadata failures must not block local mod management.
- Keep local-first architecture.
- Store mod metadata in each mod's `meta.json`.
- Do not expose raw technical details in the UI unless needed.

## Metadata Model

Target metadata shape:

```ts
type ModMetadata = {
  displayName: string;
  detectedName?: string;
  customName?: string;
  source?: "local" | "curseforge" | "modthesims" | "manual";
  sourceUrl?: string;
  previewUrl?: string;
  localPreviewPath?: string;
  lockedName?: boolean;
  updatedAt?: string;
};
```

Name priority:

1. `customName`
2. `detectedName`
3. fallback local folder/file name

Examples:

```text
McCmdCenter_AllModules_2026_2_0 -> Mc Command Center
wickedwhims_v182                -> WickedWhims
random_mod_file_1_2_3           -> Random Mod File
```

## Provider Architecture

Provider abstraction:

```ts
type MetadataProvider = {
  id: string;
  name: string;
  canHandleUrl(url: string): boolean;
  fetchMetadataFromUrl(url: string): Promise<ResolvedModMetadata>;
};

type ResolvedModMetadata = {
  displayName?: string;
  description?: string;
  sourceUrl: string;
  previewUrl?: string;
  author?: string;
  version?: string;
};
```

Initial providers:

- LocalNameProvider: deterministic local name cleanup and alias rules.
- CurseForgeProvider: API-based metadata provider, graceful when API key is missing.
- ModTheSimsProvider: user-pasted URL metadata scraping only, conservative and best-effort.

## Theme Model

Target theme shape:

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

Requirements:

- Default accent remains `#10b981`.
- Theme persists locally.
- Theme applies through CSS variables.
- Invalid imported JSON must not break UI.

## Checkpoints

### Checkpoint 1: Issue text cleanup

- Test empty issues state contains no emoji.
- Replace `No issues detected ✔` with `No issues detected`.
- Commit separately.

### Checkpoint 2: Metadata model and `meta.json` persistence

- Add Rust tests for reading and writing metadata.
- Add custom name priority over detected name.
- Missing or invalid `meta.json` must not crash scanning.
- Commit separately.

### Checkpoint 3: Official name detection

- Add tests for known filename cleanup cases.
- Implement deterministic local name detection.
- Include alias map for known popular mods.
- Commit separately.

### Checkpoint 4: Editable display name

- Add UI flow for renaming mod display name.
- Store custom name in `meta.json`.
- Test persistence and name priority.
- Commit separately.

### Checkpoint 5: Provider abstraction

- Add provider interfaces and provider selection.
- Add URL matching tests.
- Do not add scraping yet.
- Commit separately.

### Checkpoint 6: URL metadata attachment

- Add UI for attaching source URL to a mod.
- Select provider from URL.
- Store `sourceUrl` and fetched metadata when available.
- Add browser fallback action.
- Commit separately.

### Checkpoint 7: CurseForge provider

- Add API provider behind abstraction.
- Handle missing API key gracefully.
- Add mocked tests.
- Do not require an API key for startup or tests.
- Commit separately.

### Checkpoint 8: ModTheSims provider

- Add URL-based scraping only.
- Add mocked HTML fixture tests.
- Extract title, author, description, and preview image when possible.
- Fail gracefully.
- Commit separately.

### Checkpoint 9: Theme editor

- Add custom theme model.
- Add editor UI.
- Apply via CSS variables.
- Add reset, export JSON, and import JSON.
- Validate imported JSON.
- Add persistence/import/export tests.
- Commit separately.

### Checkpoint 10: Sidebar behavior

- Hide sidebar by default when one game instance exists.
- Show sidebar when multiple instances exist.
- Add manual collapse and expand control.
- Persist collapsed state.
- Keep friendly labels and avoid full paths by default.
- Commit separately.

### Checkpoint 11: Safe uninstall

- Add uninstall option per mod.
- Require confirmation.
- Disable mod first.
- Remove app-created symlinks.
- Move managed folder to trash instead of deleting permanently.
- Move existing installed external files/folders to trash when uninstalling before migration.
- Add trash listing and restore workflow.
- Add tests for confirmation, trash movement, symlink removal, unmanaged file safety, restore, and failure safety.
- Commit separately.

## Final Validation

Before final Phase 2 completion report, run:

```bash
npm run test:run
npm run build
npm run test:coverage
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml --features tauri-app
```

## Notes

- CurseForge API key may be needed for real API calls, but tests must not require it.
- ModTheSims support is best-effort metadata extraction from user-provided URLs only.
- Downloading, installing from web, profiles, dependency management, and conflict detection remain future work unless explicitly added later.
