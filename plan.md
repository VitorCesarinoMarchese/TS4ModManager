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
- Settings includes Manage All Mods for bulk external migration with loading/progress feedback.
- Trash list filters out unrelated user trash and shows only mod/app-related entries.
- Trash entries parse `.trashinfo` and show original path plus deletion date when available.
- Settings modal and game instance sidebar have exit animations.
- Custom path entry hints that users must select `The Sims 4`, not `Mods`, and auto-submits the parent when `Mods` is entered.
- Settings can copy diagnostics for support, including app version/build target, selected instance, counts, runtime paths, Wayland workaround state, and recent issues; copy shows success toast.
- Tauri release bundling is enabled for Linux AppImage and deb targets, with README packaging/troubleshooting instructions.
- Manage All has confirmation with external mod count and large-folder warning.
- Restore path collisions show clearer guidance to open the Mods folder and move/rename existing files.
- Source URL metadata now persists fetched titles and cover image URLs; backend can resolve CurseForge/ModTheSims page metadata server-side when browser fetch fails.

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
npm run test:coverage  -> 144 frontend tests, branch coverage 82.15%
npm run build          -> passing
cargo test             -> 99 passed
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

## Next Major Work: CurseForge Source Auto-Detect + Verification

Progress:

- Phase 0 started: `src-tauri/src/curseforge_client.rs` isolates CurseForge request/fixture parsing, and `docs/curseforge-api-spike.md` documents current assumptions and unknowns.
- Slice 1 started: `src-tauri/src/source_candidates.rs` defines source candidate/evidence domain DTOs and confidence levels.
- Local fingerprint extraction added in `src-tauri/src/source_fingerprint.rs` for grouped/loose mods, version tokens, useful files, and ignore rules.
- Deterministic scoring added in `src-tauri/src/source_scoring.rs` with caps, confidence levels, and candidate sorting.
- Mocked backend lookup command added via fixture provider for `find_source_candidates`; it extracts fingerprints and returns review candidates without mutating files.
- UI review flow started: Mod Details can find source candidates, show loading/empty states, show confidence/evidence, attach/open/ignore candidates, and warn on low confidence.
- Slice 4 started: Settings includes CurseForge API key storage in app settings/localStorage, not per-mod metadata.


### Goal

Help users attach a verified source URL to an installed Sims 4 mod by generating CurseForge candidates from local file evidence, ranking them by confidence, and requiring explicit user confirmation before saving anything.

### Non-goals

- Do not download mods.
- Do not update mods.
- Do not delete unmanaged files.
- Do not auto-attach sources silently.
- Do not treat weak name matches as verified.
- Do not store API keys in per-mod metadata.

### Phase 0: API Verification Spike

Goal: prove CurseForge integration assumptions before building UI around them.

Tasks:

1. Verify Sims 4 `gameId`.
2. Verify CurseForge API key flow.
3. Verify `GET /v1/mods/search` with Sims 4.
4. Verify file metadata availability.
5. Verify fingerprint or fuzzy fingerprint matching for Sims 4 files.
6. Document usable CurseForge fields for matching.

Acceptance criteria:

- Mocked API fixtures exist from real response shapes.
- Tests do not depend on live CurseForge.
- Live API is only used through one backend client module.
- Project docs state which CurseForge fields are reliable for matching.

### Phase A: Domain Model and Provider Abstraction

Add backend domain types:

```rust
SourceProvider
SourceCandidate
SourceEvidence
ModFingerprint
SourceLookupError
```

Create provider abstraction:

```rust
trait SourceProvider {
    async fn find_candidates(
        &self,
        fingerprint: ModFingerprint
    ) -> Result<Vec<SourceCandidate>, SourceLookupError>;
}
```

This keeps CurseForge isolated and makes ModTheSims easier to add later.

Backend DTO:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCandidate {
    pub provider_id: SourceProviderId,
    pub title: String,
    pub source_url: String,
    pub preview_url: Option<String>,
    pub author: Option<String>,
    pub project_id: Option<u64>,
    pub file_id: Option<u64>,
    pub confidence: u8,
    pub confidence_level: ConfidenceLevel,
    pub reasons: Vec<String>,
    pub evidence: Vec<SourceEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceProviderId {
    Curseforge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfidenceLevel {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceEvidence {
    pub kind: String,
    pub description: String,
    pub weight: i16,
}
```

Frontend type:

```ts
export type SourceCandidate = {
  providerId: "curseforge";
  title: string;
  sourceUrl: string;
  previewUrl?: string;
  author?: string;
  projectId?: number;
  fileId?: number;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  reasons: string[];
  evidence: Array<{
    kind: string;
    description: string;
    weight: number;
  }>;
};
```

### Phase B: Local Fingerprint Extraction

For selected mod, collect:

- display name
- folder name
- normalized name
- relative paths
- basenames
- extensions
- file sizes
- package/script names
- version tokens
- optional hashes/fingerprints
- archive name if imported through the app
- existing manual source URL if already attached

Version token examples:

```text
2026_2_0
v1.2.3
1.110
2026.2.0
```

Ignore:

- thumbnails
- preview images
- logs
- generated app metadata
- `meta.json`

Acceptance criteria:

- No file mutation.
- Handles external and managed mods.
- Handles grouped mods with multiple files.
- Handles loose `.package` and `.ts4script` files.
- Handles folders with mixed useful and irrelevant files.

### Phase C: CurseForge Client

Build a small client with these operations:

```text
search_mods
get_mod
get_mod_files
match_fingerprints
fuzzy_match_fingerprints
```

Typed errors:

```text
MissingApiKey
Unauthorized
RateLimited
Network
InvalidResponse
ProviderUnavailable
NoUsableEvidence
```

API key storage:

1. Use app settings for MVP.
2. Move to OS keyring later if desired.
3. Never store API key in per-mod metadata.

### Phase D: Candidate Discovery Pipeline

Discovery order:

1. Extract local fingerprint.
2. Try exact/fuzzy fingerprint match.
3. If enough evidence exists, build high-confidence candidate.
4. Otherwise, search by normalized mod name.
5. If weak results, search by folder basename.
6. If still weak, search by top package/script basename.
7. Fetch file metadata for likely candidates when available.
8. Score candidates.
9. Deduplicate by `projectId` or `sourceUrl`.
10. Sort by confidence.
11. Return top 5 candidates.

Matching preference order:

1. Exact fingerprint match.
2. Fuzzy fingerprint match.
3. Exact archive/file name match.
4. Exact package/script basename match.
5. Version token match.
6. Title/name similarity.
7. Package/script basename overlap.
8. Author match.
9. Name-only match.

### Phase E: Deterministic Confidence Scoring

Positive evidence:

```text
+95 exact fingerprint match
+80 fuzzy fingerprint match
+40 exact archive/file name match
+25 exact package/script basename match
+20 version token match
+20 title/name similarity
+15 package/script basename overlap
+10 slug similarity
+5 author match
```

Negative evidence:

```text
-30 different author when known
-25 conflicting version token
-20 unrelated file names
-15 candidate is not available/searchable
-10 generic title only, such as "traits", "career", "poses"
```

Caps:

```text
Name-only match max 55
No file evidence max 60
Search result without file metadata max 70
Fingerprint match minimum 85 unless there is conflicting evidence
```

Confidence levels:

```text
High: 85 to 100
Medium: 70 to 84
Low: 40 to 69
Do not return: below 40
```

### Phase F: UI Review Flow

Add to Mod Details:

- `Find Source` button
- missing API key state
- loading state
- error state
- empty state
- candidate cards
- confidence badge
- evidence/reasons
- preview image
- `Attach`
- `Open`
- `Ignore`

UI rules:

- If exactly one high-confidence match exists, show it first but still require confirmation.
- If confidence is at least 85, show `High confidence`.
- If confidence is below 70, show `Please verify before attaching.`
- Do not auto-attach silently.
- Let the user change or detach the source later.

### Phase G: Attach Source

When user clicks `Attach`:

1. Call existing `attachSourceUrl`.
2. Persist provider metadata.
3. Update UI immediately.
4. Show source as verified by user.
5. Allow detach/change later.

Future `meta.json` source metadata shape:

```ts
source: {
  providerId: "curseforge";
  sourceUrl: string;
  projectId?: number;
  fileId?: number;
  slug?: string;
  title: string;
  author?: string;
  confidenceAtAttach: number;
  attachedAt: string;
  attachedBy: "user";
  evidence: string[];
}
```

### Phase H: Bulk Mode

Bulk mode comes later, after single-mod flow is reliable.

Later features:

- Settings action: `Find Sources for All`
- Sequential scan
- Review table
- Select multiple candidates
- Attach selected candidates
- Skip low-confidence matches by default

Bulk rules:

- Do not attach anything automatically.
- Do not run all API requests in parallel.
- Respect rate limits.
- Save progress so the user can resume.
- Show skipped/failed/low-confidence items separately.

### Phase I: Tests

Backend tests:

- Extracts version tokens from names like `McCmdCenter_AllModules_2026_2_0`.
- Extracts `.package` and `.ts4script` basenames.
- Ignores images and app metadata.
- Ranks fingerprint match above all search matches.
- Ranks exact filename above name-only.
- Caps name-only matches at 55.
- Caps no-file-evidence matches at 60.
- Removes duplicate candidates.
- Handles missing API key.
- Handles 401/403.
- Handles rate limit.
- Handles malformed provider response.
- Never mutates mod files during lookup.

Frontend tests:

- Button appears for managed mods.
- Button appears for external mods.
- Missing API key message appears.
- Loading state appears.
- Candidates render with confidence and reasons.
- Low confidence warning appears.
- Attach calls existing source attach command.
- Open opens external URL.
- Ignore hides candidate locally.
- Empty state appears when no candidates are found.

### Implementation Slices

Slice 1: Pure Local Fingerprint and Scoring

```text
Commit 1: add source candidate domain types
Commit 2: add local fingerprint extraction tests
Commit 3: implement local fingerprint extraction
Commit 4: add deterministic scoring tests
Commit 5: implement scoring and candidate sorting
```

Slice 2: Mocked Backend Command

```text
Commit 6: add find_source_candidates command with fixture provider
Commit 7: add typed errors and command response tests
```

Slice 3: UI Review Flow

```text
Commit 8: add Find Source button and loading state
Commit 9: add candidate result cards
Commit 10: wire Attach, Open, Ignore actions
```

Slice 4: Real CurseForge Client

```text
Commit 11: add CurseForge settings for API key
Commit 12: add CurseForge API client with mocked response tests
Commit 13: wire search_mods
Commit 14: wire fingerprint matching if verified usable
Commit 15: replace fixture provider with CurseForge provider
```

Slice 5: Polish and Safety

```text
Commit 16: add empty/error states
Commit 17: add dedupe and confidence explanations
Commit 18: add integration tests for full lookup flow
```

### Agent Prompt Version

```text
You are working on the Sims 4 Mod Manager project.

Goal:
Implement a safe CurseForge source auto-detection flow that helps users attach a verified source URL to an installed mod.

Core behavior:
- Generate candidates from local file evidence.
- Rank candidates by confidence.
- Show candidates and reasons to the user.
- Require explicit user confirmation before attaching a source.
- Never auto-attach silently.
- Never download mods.
- Never delete unmanaged files.
- Store local metadata in meta.json.
- Do not store API keys in per-mod metadata.

Implementation rules:
- Follow TDD.
- Write tests before implementation.
- Use small atomic commits.
- One logical concern per commit.
- Run tests after each change.
- Keep CurseForge integration isolated behind a provider abstraction.
- Start with local fingerprint extraction and scoring before adding real API calls.

Recommended implementation order:
1. Add domain types for source candidates and evidence.
2. Add local fingerprint extraction tests.
3. Implement fingerprint extraction.
4. Add deterministic scoring tests.
5. Implement scoring.
6. Add a mocked backend command: find_source_candidates(modId, instanceId).
7. Add UI button and candidate review flow.
8. Add attach/open/ignore actions.
9. Add CurseForge API key settings.
10. Add CurseForge client with mocked API response tests.
11. Wire real search and fingerprint matching only after validating API response shape.
12. Add empty, error, and low-confidence states.
13. Add integration tests for the full lookup flow.

Do not start with the real API integration. First make the local fingerprint, scoring, command contract, and UI review flow work with fixtures.
```

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
