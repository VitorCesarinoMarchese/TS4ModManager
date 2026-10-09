# Native management UI design

This Fastframe/egui UI keeps TS4 Mod Manager's existing green accent and light/dark appearance. The Rust core owns filesystem and provider behavior. The React/Tauri app remains available.

## Scope

The catalog reads game folders, searches mod names and filenames, and displays installed/stored state, files, photos, and saved source metadata. The management bar imports folders and ZIP archives, reviews enable and disable, migrates reviewed external files, renames managed mods, finds or attaches sources, and moves or restores managed mods through trash.

A separate FIFO worker retains approved operations. Review, lookup, and dialog results bind to operation ID, root, entry identity, and scan generation. Stale results cannot replace a new selection. Changes request a fresh scan for the current root because managed storage and metadata are shared across roots. Approved jobs finish before the window closes.

Source attachment and removal require explicit confirmation. Candidate confidence, reasons, and evidence appear before attachment. Keep weak-match warnings visible in both the candidate list and confirmation. Broken candidate images hide. Saved previews retain No Preview fallback and HTTP requests without a Referer header. The app does not download or update mods.

Startup asks the core to recover pending operations and displays recovery issues. Native toggle and migration hold the shared writer guard across revalidation and mutation. A forced process termination can interrupt approved work; core recovery preserves changed or ambiguous user paths and may require attention before further mutations. OS kill, reboot, touchpad, monitor, and screen-reader checks still need separate evidence.

Settings use atomic local writes with mode 0600 on Unix. Transfer JSON uses the shared version 1 schema. Export requires an unused file path and excludes the API key by default. Import is bounded to 1 MiB and shows its theme, roots, selected root, and API-key behavior before confirmation. An omitted key preserves the existing local key. CLI overrides remain transient.

## Appearance tokens

Values below describe `src/ui.rs`. Dimensions use egui logical points.

| Role | Light | Dark |
| --- | --- | --- |
| Header, catalog, status background | `#F8FAFC` | `#15171C` |
| Details and extreme background | `#FFFFFF` | `#1C1F24` |
| Main text | `#020617` | `#F8FAFC` |
| Selection background | `#D1FAE5` | `#0A4636` |
| Selection stroke | `#065F46` | `#6EE7B7` |

Other widget colors, weak text, and error colors follow egui's theme. Use Fastframe's default font definitions and detected platform text rendering. The pilot defines no custom font family.

| Element | Size or spacing |
| --- | --- |
| App title | 22, strong |
| Catalog / selected mod title | 24 / 23, strong |
| Catalog name / metadata | 15 / 12, truncated |
| Header margins | 24 horizontal, 16 vertical |
| Catalog and details / status margins | 24 / 24 horizontal, 10 vertical |
| Global item spacing | 10 horizontal, 8 vertical |
| Button padding | 12 horizontal, 8 vertical |
| Catalog row | 64 high; 12 horizontal and 10 vertical inner inset |
| Row name-to-metadata spacing | 5 |
| Row highlight corner radius | 6 |
| Catalog thumbnail | 44 square, centered crop, 6 corner radius |
| Detail photo | 180 high, contain, 6 corner radius |
| File row | 48 high; basename 13, folder path 11 |
| Search field | 40 high; 8 corner radius |
| Buttons | Minimum 34 high; 6 corner radius |
| Muted text, light / dark | `#556170` / `#AAB3BE` noninteractive foreground |
| Search / general action / Copy icon | 18 / 16 / 14 |

## Layout and interaction

At available widths of 900 or greater, show the catalog beside a right details pane. The pane starts at 350 wide and has limits of 280 and 480. Below 900, selecting a mod replaces the catalog with details; Back to mods restores the list. Keep the game-folder header and status visible in both views.

Follow the saved theme preference, or the desktop theme when no preference exists. The Light/Dark button switches themes. The current folder appears as a compact path summary with a full-path tooltip. Change folder reveals the path editor and detected-folder menu. On first launch the editor is already visible. Open accepts a nonempty trimmed path; Enter in the folder field also opens it. Choosing a detected folder starts a scan. Disable Rescan while loading or before a root exists.

Search filters as the text changes and displays the match count. Catalog rows use egui's selected, hover, and focus visuals. Full mod names appear in hover text. Rows separate the name and ownership/file count from installed/stored state. File rows show the basename first and the folder below it, with full-path tooltips and selectable basenames. Copy copies the complete file list and confirms with Copied for two seconds. Selected-row secondary text uses the green selection foreground.

Render only visible catalog and file rows. Load saved image paths and URLs in the background, showing a spinner while pending and No Preview when absent or broken. The detail summary has its own scroll area, reserving 150 points for file controls and rows where space allows. Its minimum viewport is 80 points. Local relative previews resolve under the chosen Mods folder. Reset preview caching on a new scan; retain at most 32 URIs. HTTP requests and redirects send no Referer header. Show separate guidance for initial folder selection, scanning, empty catalogs, and no matches. Errors explain how to retry. Saved source URLs are selectable wrapped text. Keep the local-first status visible throughout. The management bar uses the catalog background and existing button sizes. Import folder uses the green selection fill and stroke as its primary emphasis; Restore from trash and Settings use secondary button styling. Review dialogs show exact filesystem paths and warnings before Confirm.

## Evidence

This document records the implemented controls and tokens in `src/ui.rs`, with management scope from `README.md` and `../docs/native-management-design.md`. It does not define a broader product identity or claim that desktop performance and touchpad behavior have been validated.
