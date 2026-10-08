# Native pilot design

This Fastframe/egui pilot extends TS4 Mod Manager's existing green accent and light/dark appearance. It evaluates browsing large local catalogs. The React/Tauri app remains available for file-management actions.

## Scope

The pilot reads game folders, searches mod names and filenames, and displays installed/stored state, files, and saved source metadata. It makes no provider requests and offers no import, enable/disable, download, update, source attachment, trash/restore, or preview loading actions.

Any future source attachment must require explicit user confirmation. Keep weak-match warnings visible; saved metadata does not establish a verified match. The current details view warns when an attachment's recorded confidence is below 70.

## Appearance tokens

Values below describe `src/ui.rs`. Dimensions use egui logical points.

| Role | Light | Dark |
| --- | --- | --- |
| Header, catalog, status background | `#F8FAFC` | `#15171C` |
| Details and extreme background | `#FFFFFF` | `#111827` |
| Main text | `#020617` | `#F8FAFC` |
| Selection background | `#D1FAE5` | `#0A4636` |
| Selection stroke | `#065F46` | `#6EE7B7` |

Other widget colors, weak text, and error colors follow egui's theme. Use Fastframe's default font definitions and detected platform text rendering. The pilot defines no custom font family.

| Element | Size or spacing |
| --- | --- |
| App title | 23, strong |
| Selected mod title | 21, strong, wrapped |
| Catalog name / metadata | 16 / 12, truncated |
| Header / catalog and details / status margins | 20 / 24 / 12 |
| Global item spacing | 10 horizontal, 8 vertical |
| Button padding | 12 horizontal, 8 vertical |
| Catalog row | 62 high; 12 horizontal and 8 vertical inner inset |
| Row name-to-metadata spacing | 4 |
| Row highlight corner radius | 6 |
| File row | 24 high |
| Search / general action / Copy icon | 18 / 16 / 14 |

## Layout and interaction

At available widths of 900 or greater, show the catalog beside a right details pane. The pane starts at 360 wide and has limits of 280 and 480. Below 900, selecting a mod replaces the catalog with details; Back to mods restores the list. Keep the game-folder header and status visible in both views.

Follow the desktop theme initially. The Light/Dark button switches themes. Open accepts a nonempty trimmed path; Enter in the folder field also opens it. Choosing a detected folder starts a scan. Disable Rescan while loading or before a root exists.

Search filters as the text changes and displays the match count. Catalog rows use egui's selected, hover, and focus visuals. Full mod names appear in hover text. Files truncate with full-path tooltips, support text selection, and Copy copies the complete file list.

Render only visible catalog and file rows. Show separate guidance for initial folder selection, scanning, empty catalogs, and no matches. Errors explain how to retry. Saved source URLs are selectable wrapped text. Keep the read-only status visible throughout.

## Evidence

This document records the implemented controls and tokens in `src/ui.rs`, with pilot scope from `README.md` and `../docs/native-pilot-design.md`. It does not define a broader product identity or claim that desktop performance and touchpad behavior have been validated.
