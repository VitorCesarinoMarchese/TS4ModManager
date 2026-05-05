# Sims 4 Linux Mod Manager — MVP Specification (Authoritative)

Version: 1.0  
Date: 2026-05-04

## 1) Product Goal
A Linux-first desktop app (Tauri + React + Rust) to safely manage Sims 4 mods with local-first behavior.

## 2) Core Principles
- Filesystem is source of truth
- No destructive operations on user originals
- Reversible operations only
- Proton support is mandatory
- TDD is mandatory for all features

## 3) In-Scope MVP Features
- Auto-detect Sims 4 game instances (native, Steam/Proton, custom)
- Scan and index mods from game Mods folder
- Import mods into managed directory
- Archive import support: `.zip`, `.rar`, `.7z`
- Nested/grouped mod display in UI
- Enable/disable mods via symlinks
- Search/filter installed mods
- Preview image detection (best candidate by size/resolution)
- External symlink detection + migration flow
- Dry-run preview before filesystem changes
- Issues surfacing via toast + persistent Issues panel + log file

## 4) Out of Scope (MVP)
- CurseForge/external API integration
- Download manager from online sources
- Dependency/conflict graph resolution beyond collision checks
- Auto-cleanup of orphan symlinks

## 5) Tech Stack
- Frontend: React + TypeScript
- Desktop: Tauri
- Backend: Rust (Tauri commands)
- State: Zustand
- Testing: Rust `#[test]`, Vitest + React Testing Library

## 6) Data Model

### 6.1 Mod
```ts
type Mod = {
  id: string // UUID v4
  name: string
  slug?: string // display aid only
  files: string[] // includes non-mod assets too
  enabled: boolean
  preview?: string
  source: "managed" | "external"
  groupPath?: string[] // for nested display
}
```

### 6.2 GameInstance
```ts
type GameInstance = {
  id: string
  path: string
  source: "native" | "steam" | "custom"
}
```

### 6.3 Metadata Sidecar
Path: `~/.local/share/sims4-mod-manager/mods/<mod-id>/meta.json`

```json
{
  "version": 1,
  "createdBy": "sims4-mod-manager",
  "modId": "<uuid-v4>",
  "name": "<display-name>",
  "slug": "<optional-slug>",
  "files": ["..."],
  "source": "managed"
}
```

## 7) Filesystem Layout

### 7.1 Managed Directory
```
~/.local/share/sims4-mod-manager/
  mods/
    <mod-id>/
      files/
      meta.json
      enabled
  logs/
    app.log
```

### 7.2 Game Mods Folder
Native default:
```
~/Documents/Electronic Arts/The Sims 4/Mods
```

Proton variants discovered via Steam library scan.

## 8) Path Detection Requirements
Must scan:
- `~/.steam/steam/steamapps`
- `~/.local/share/Steam/steamapps`
- `~/.steam/root/steamapps`
- `~/.var/app/com.valvesoftware.Steam/.steam/steamapps`
- `~/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps`

Also parse:
- `steamapps/libraryfolders.vdf`

Then search compatdata prefixes for:
```
pfx/drive_c/users/*/Documents/Electronic Arts/The Sims 4
```

Multiple instances are user-selectable in Settings. Custom paths are supported.

## 9) Mod Detection and Grouping
1. Recursively scan target Mods directory.
2. Group by folder primarily.
3. Fallback grouping: filename prefix match.
4. Include non-mod assets in `files[]`.
5. Relevant mod extensions: `.package`, `.ts4script`.
6. Preview heuristic: choose highest size/resolution among image candidates (`*.png`, `*.jpg`, `preview.*`, `cover.*`).

## 10) Enable/Disable Semantics
- Enable = create symlinks in game Mods folder.
- Disable = remove manager-created symlinks only.
- Never delete original files.
- Never modify original files.
- Managed mode links must point only into managed directory.

### 10.1 External Symlinks
- Initial scan may index pre-existing symlinks pointing anywhere.
- Mark these mods as `External`.
- UI toggle on External triggers migration into managed directory.
- Do not edit external links in place.

## 11) Conflict & Duplicate Policy
### Path-level collision
- If destination relative path already exists in game Mods folder, block that file link operation.
- Operation continues for non-conflicting files where safe, with warnings.

### Content-level duplicate
- Compute content hash for duplicate detection.
- Warn when identical content already exists.
- Does not block unless path collision occurs.

## 12) Safety and Operations
- All mutating operations must support dry-run preview.
- Validate and normalize paths before mutation.
- Never overwrite existing user files.
- Never auto-delete orphan symlinks; warn user only.

## 13) Error/Warning Reporting
Every operation should report through:
1. Immediate toast
2. Persistent Issues panel entry
3. Log file entry (`~/.local/share/sims4-mod-manager/logs/app.log`)

## 14) Typed Backend Error Schema
All Rust command failures must map to typed error codes (stable contract), e.g.:
- `INVALID_PATH`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `PATH_COLLISION`
- `EXTERNAL_LINK`
- `ARCHIVE_UNSUPPORTED`
- `ARCHIVE_EXTRACTION_FAILED`
- `IO_ERROR`
- `INTERNAL_ERROR`

## 15) TDD & CI Policy (Mandatory)
For every feature:
1. Write tests first
2. Run tests (must fail)
3. Implement minimal code
4. Run tests (must pass)
5. Refactor with green tests

CI gates:
- Fail if tests fail
- Enforce coverage target for core logic: >=80%
- Filesystem mutation paths must be covered by tests
- PRs touching behavior require corresponding tests

## 16) MVP Acceptance Criteria
- App launches and auto-detects Sims 4 instances
- User can choose active instance
- Mods scan/import works for folder and archives
- UI shows nested/grouped mod cards with search
- Enable/disable works via safe symlink operations
- External mods are visible and migratable
- Conflicts/duplicates handled per policy
- No destructive file loss scenarios
- All implemented filesystem operations are test-covered
