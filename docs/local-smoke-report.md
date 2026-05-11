# Local Smoke Report

Date: 2026-05-10

## Scope

Local verification for release readiness and Linux packaging. A second-computer Wayland smoke test still requires running the generated build on that machine.

## Results

| Check | Result | Notes |
| --- | --- | --- |
| Frontend coverage | Passed | 138 tests, branch coverage above 80%. |
| Rust tests | Passed | 73 tests. |
| Frontend production build | Passed | `npm run build`. |
| Tauri feature check | Passed | `cargo check --features tauri-app`. |
| Debian package build | Passed | `npm run tauri:build:deb`. |
| Debian package file | Passed | `src-tauri/target/release/bundle/deb/TS4 Mod Manager_0.1.0_amd64.deb`, Debian binary package, 3.4 MB. |
| AppImage build | Blocked in current environment | `linuxdeploy` failed during AppImage bundling. Retry on a normal Linux desktop with FUSE/AppImage support. |

## Manual checks still needed on target computer

1. Launch installed deb or AppImage.
2. Confirm Wayland crash no longer occurs.
3. Add valid Sims 4 custom path.
4. Use Manage All on real mod folder.
5. Move a mod to trash and restore it.
6. Copy diagnostics from Settings.
