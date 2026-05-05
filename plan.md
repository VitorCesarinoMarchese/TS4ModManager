# Sims 4 Linux Mod Manager — Plan

## Overview

A Linux-first desktop application to manage The Sims 4 mods.  
Inspired by Deadlock Mod Manager, but focused on a **local-first MVP**.

The application will:

- Detect Sims 4 installations (native + Proton)
- Scan installed mods
- Display them in a clean UI
- Allow enabling/disabling mods safely
- Avoid any destructive file operations

---

## Philosophy

- Filesystem is the source of truth
- No external APIs in MVP
- Safe and reversible operations only
- Minimal friction UX (no manual folder handling)
- Linux-first experience

---

## MVP Scope

### Features

- Auto-detect Sims 4 installations
- Scan Mods directory
- Represent mods as structured entities
- Display mods in UI
- Enable / disable mods
- Search installed mods
- Basic preview image detection

---

## Tech Stack

- **Frontend:** React + TypeScript
- **Desktop:** Tauri
- **Backend (internal):** Rust (Tauri commands)
- **State Management:** Zustand or React Context

---

## Filesystem Design

### Managed Directory

```
~/.local/share/sims4-mod-manager/
  mods/
    <mod-id>/
      files/
      meta.json
      enabled
```

---

### Game Mods Folder

```
~/Documents/Electronic Arts/The Sims 4/Mods
```

(Proton paths also supported)

---

## Enable / Disable Strategy

### Enabled
- Create symlinks into Sims 4 Mods folder

### Disabled
- Remove symlinks only

### Rules

- Never delete original mod files
- Never modify original files
- Only manage symlinks

---

## Mod Model

```ts
type Mod = {
  id: string
  name: string
  files: string[]
  enabled: boolean
  preview?: string
}
```

---

## Mod Detection Strategy

1. Scan Mods folder recursively
2. Group files by:
   - Folder
   - Filename similarity (fallback)
3. Extract:
   - Name from filename/folder
   - Files list
4. Detect preview image if present

---

## UI Design

### Pages

#### Home

- Grid/list of mod cards
- Each card contains:
  - Name
  - Preview image (if available)
  - Enable/disable toggle
  - File count

---

#### Settings

- Display detected game paths
- Button: "Rescan Mods"

---

### UI Style

- Material Design inspired
- Clean card-based layout
- Minimal clutter

---

## Linux-Specific Features (Core Requirement)

### Native Path Detection

```
~/Documents/Electronic Arts/The Sims 4
```

---

### Proton Detection

Scan:

```
~/.steam/steam/steamapps/compatdata/*
~/Games/*
```

Look for:

```
pfx/drive_c/users/*/Documents/Electronic Arts/The Sims 4
```

---

### Game Instance Model

```ts
type GameInstance = {
  path: string
  source: "native" | "steam" | "custom"
}
```

---

## Image Detection (MVP Heuristic)

Search for:

- `*.png`
- `*.jpg`
- `preview.*`
- `cover.*`

Use first match as preview image.

---

## Safety Rules

- Never delete user data
- Only manipulate symlinks
- Validate all paths before operations
- Avoid overwriting files
- Keep operations reversible

---

## Not Included in MVP

- CurseForge API integration
- Mod downloading
- Scraping external sources
- Dependency resolution
- Conflict detection
- Version tracking

---

## Future Expansion

Planned for V2+:

- CurseForge API integration
- Scraper for non-CurseForge mods
- Download manager
- Mod updates tracking
- Dependency resolution
- Conflict detection
- Profiles system
- Mod metadata enrichment

---

## Architecture (Simplified)

| Layer        | Responsibility                |
|-------------|-----------------------------|
| React UI     | Display + user interaction   |
| Tauri Core   | Bridge frontend/backend      |
| Rust Commands| Filesystem + detection logic |

---

## MVP Success Criteria

- App launches and detects Sims 4 automatically
- Mods are listed correctly
- User can enable/disable mods
- No manual file handling required
- No data loss or destructive behavior

---

## Key Design Decisions

### 1. Mods are entities, not files
Group related files into a single mod object.

### 2. Use symlinks instead of copying
- Faster
- Reversible
- Cleaner

### 3. Proton support is mandatory
This is a core differentiator.

### 4. UX must hide filesystem complexity
User should not think about:
- folders
- prefixes
- file types

---



---

## 🧪 Test-First Development (TDD Requirement)

This project must follow a **test-first approach**.  
All features should be implemented using **Test-Driven Development (TDD)** principles.

### Core Rules

1. **Write tests before implementation**
   - Define expected behavior first
   - Tests should fail initially

2. **Implement minimal code to pass tests**
   - Do not over-engineer
   - Focus only on satisfying test conditions

3. **Refactor after passing**
   - Clean code
   - Improve structure
   - Maintain passing tests

---

### Testing Strategy

#### Backend (Rust / Tauri commands)

- Use Rust unit tests (`#[test]`)
- Test:
  - Path detection
  - Mod scanning logic
  - Grouping algorithm
  - Enable/disable (symlink behavior)

Example areas to test:

- Detecting valid Sims 4 directories
- Correct grouping of mod files into a single mod
- Safe symlink creation/removal
- Handling invalid paths

---

#### Frontend (React)

- Use:
  - Vitest or Jest
  - React Testing Library

Test:

- Mod list rendering
- Toggle behavior
- Search filtering
- UI state consistency

---

### Agent Behavior Requirement

When implementing any feature, the agent must:

1. Create test file first
2. Define expected inputs/outputs
3. Run tests (expect failure)
4. Implement feature
5. Run tests again (must pass)
6. Only then proceed

---

### Example Workflow

1. Create test:
   - "should detect mods from a directory"

2. Run → FAIL

3. Implement scan function

4. Run → PASS

5. Refactor safely

---

### Test Coverage Goals (MVP)

- Core logic: high coverage (≥80%)
- UI: focus on behavior, not styling
- Filesystem operations: must be tested

---

### Critical Note

This project interacts with user files.

**All filesystem operations must be covered by tests before execution.**

No untested destructive or semi-destructive operation is allowed.

---


## Next Steps

1. Scaffold Tauri + React project
2. Implement Rust commands:
   - Detect game paths
   - Scan Mods directory
3. Build mod grouping logic
4. Implement UI (Home + Settings)
5. Add enable/disable logic via symlinks
6. Add search functionality
