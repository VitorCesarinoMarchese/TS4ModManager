# Native pilot design

This Fastframe/egui pilot extends TS4 Mod Manager's existing green accent and light/dark appearance. It evaluates browsing large local catalogs. The React/Tauri app remains available for file-management actions.

## Scope

The pilot reads game folders, searches mod names and filenames, and displays installed/stored state, files, photos, and saved source metadata. It makes no provider API requests and offers no import, enable/disable, mod download/update, source attachment, or trash/restore actions. Saved preview images may be fetched; the pilot never writes preview files or attaches sources.

Any future source attachment must require explicit user confirmation. Keep weak-match warnings visible; saved metadata does not establish a verified match. The current details view warns when an attachment's recorded confidence is below 70.

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

Follow the desktop theme initially. The Light/Dark button switches themes. The current folder appears as a compact path summary with a full-path tooltip. Change folder reveals the path editor and detected-folder menu. On first launch the editor is already visible. Open accepts a nonempty trimmed path; Enter in the folder field also opens it. Choosing a detected folder starts a scan. Disable Rescan while loading or before a root exists.

Search filters as the text changes and displays the match count. Catalog rows use egui's selected, hover, and focus visuals. Full mod names appear in hover text. Rows separate the name and ownership/file count from installed/stored state. File rows show the basename first and the folder below it, with full-path tooltips and selectable basenames. Copy copies the complete file list and confirms with Copied for two seconds. Selected-row secondary text uses the green selection foreground.

Render only visible catalog and file rows. Load saved image paths and URLs in the background, showing a spinner while pending and No Preview when absent or broken. The detail summary has its own scroll area, reserving 150 points for file controls and rows where space allows. Its minimum viewport is 80 points. Local relative previews resolve under the chosen Mods folder. Reset preview caching on a new scan; retain at most 32 URIs. HTTP requests and redirects send no Referer header. Show separate guidance for initial folder selection, scanning, empty catalogs, and no matches. Errors explain how to retry. Saved source URLs are selectable wrapped text. Keep the read-only status visible throughout.

## Evidence

This document records the implemented controls and tokens in `src/ui.rs`, with pilot scope from `README.md` and `../docs/native-pilot-design.md`. It does not define a broader product identity or claim that desktop performance and touchpad behavior have been validated.
