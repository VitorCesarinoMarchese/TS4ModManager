# TDD Implementation Plan — Sims 4 Linux Mod Manager

Source of truth: `MVP_SPEC.md`.
Rule: every feature follows Red → Green → Refactor.

## 0) Repo bootstrap (tests first)

### 0.1 Project scaffold
- Create Tauri + React + TypeScript project.
- Add Zustand.
- Add Rust test support.
- Add Vitest + React Testing Library.

### 0.2 CI gates
- Run Rust + frontend tests on PR.
- Enforce coverage >=80% on core logic.
- Fail PR when behavior changes without tests.

### 0.3 Shared contracts
- Define backend error enum + serialized API error type.
- Define TS types: `Mod`, `GameInstance`, `Issue`, `DryRunResult`.
- Add contract tests for error-code mapping.

---

## 1) Path detection module (Rust)

### Tests first
1. Detect native Sims path if exists.
2. Detect Steam roots in all required locations.
3. Parse `libraryfolders.vdf` custom libs.
4. Detect Proton Sims paths under `compatdata/*/pfx/.../Documents/...`.
5. Return multiple instances with correct `source`.
6. Reject invalid/custom path with typed error.

### Impl minimal
- `detect_game_instances()` command.
- `validate_custom_instance(path)` command.

### Refactor
- Pure fs scanner functions separated from Tauri command wrappers.

---

## 2) Mod scan + grouping (Rust)

### Tests first
1. Recursive scan collects files.
2. Group primary by folder.
3. Fallback group by filename prefix.
4. Include non-mod assets in `files[]`.
5. Identify `.package` and `.ts4script` as mod files.
6. Preview selection picks highest resolution/size image.
7. Detect symlink entries and tag external sources.

### Impl minimal
- `scan_mods(instance_path)` command.
- Internal grouping + preview heuristic helpers.

### Refactor
- Stable deterministic ordering for snapshots/tests.

---

## 3) Managed storage + metadata (Rust)

### Tests first
1. Create managed mod folder with UUID v4.
2. Write `meta.json` with `version: 1` schema.
3. Persist file manifest includes assets.
4. Read/validate metadata schema version.
5. Reject malformed metadata with typed error.

### Impl minimal
- `create_managed_mod(import_payload)`
- `read_managed_mod(mod_id)`

### Refactor
- Metadata serializer/deserializer module.

---

## 4) Archive import pipeline (Rust)

### Tests first
1. Import `.zip` happy path.
2. Unsupported extension returns `ARCHIVE_UNSUPPORTED`.
3. Corrupt archive returns `ARCHIVE_EXTRACTION_FAILED`.
4. Extraction path traversal blocked (`../` entries).
5. Imported files end in managed `files/` only.

### Impl minimal
- Unified extractor interface.
- Zip extractor first.
- Rar/7z adapters behind same interface.

### Refactor
- Expand archive matrix tests for `.rar`, `.7z`.

---

## 5) Enable/disable + dry-run (Rust)

### Tests first
1. Dry-run enable lists symlinks to create.
2. Dry-run disable lists symlinks to remove.
3. Enable creates links only to managed directory.
4. Disable removes manager-owned links only.
5. Path collision blocks file, emits issue.
6. Hash duplicate warns, does not block.
7. Existing external links indexed, not edited in place.

### Impl minimal
- `dry_run_toggle(mod_id, target_state, instance_id)`
- `apply_toggle(mod_id, target_state, instance_id)`
- Ownership check via sidecar metadata.

### Refactor
- Transaction-like operation report object.

---

## 6) External migration flow (Rust)

### Tests first
1. External mod marked with badge state.
2. Toggle external triggers copy/import to managed storage.
3. New links point to managed dir.
4. Original external links/files untouched.

### Impl minimal
- `migrate_external_mod(external_id)` command.

### Refactor
- Reuse import + toggle pipeline.

---

## 7) Issues + logging (Rust + frontend)

### Tests first
1. Every warning/error creates issue event.
2. Issue persists in issues store.
3. Log file append works and includes operation context.
4. Toast shown for new issue events.

### Impl minimal
- Backend structured operation result with `issues[]`.
- Frontend issue bus + Zustand store.

### Refactor
- Severity levels + dedupe logic.

---

## 8) Frontend state + commands integration

### Tests first
1. Zustand store initializes empty state.
2. Loading instances populates selector.
3. Selecting instance triggers scan.
4. Search filter behavior correct.
5. Toggle action runs dry-run then apply.
6. External badge visible and migration path triggered.

### Impl minimal
- `useAppStore` slices: instances, mods, issues, ui.
- Tauri invoke wrappers.

### Refactor
- Split selectors/actions per domain.

---

## 9) UI components (React)

### Tests first
1. Home renders grouped tree/grid.
2. Mod card shows name, count, preview, badge.
3. Toggle button disabled when dry-run has blocking collisions.
4. Settings shows detected paths + custom path form.
5. Rescan button updates list.
6. Issues panel persists entries.

### Impl minimal
- `HomePage`, `SettingsPage`, `IssuesPanel`, `ModCard`, `GroupView`.

### Refactor
- Accessibility labels + keyboard nav tests.

---

## 10) End-to-end safety checks

### Tests first
1. No operation deletes original source files.
2. No operation overwrites existing user files.
3. Orphan symlink detection warns only.
4. Multi-instance switching isolates state.

### Impl minimal
- Integration test harness with temp dirs.

### Refactor
- Shared fixtures and builders.

---

## Suggested execution order (first 2 weeks)
1. Bootstrap + CI + shared contracts.
2. Path detection.
3. Mod scan/grouping.
4. Managed storage + metadata.
5. Enable/disable dry-run.
6. Basic UI wiring.

## Definition of done per ticket
- Tests added first, committed.
- Failing test evidence captured.
- Minimal implementation committed.
- All tests green.
- Coverage impact checked.
- Error codes documented if changed.
