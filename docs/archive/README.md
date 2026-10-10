# Retired app documents

These documents describe the React/Tauri app retired on 2026-10-09. Their setup commands and plans are historical. Use the [current development guide](../development.md) to build and run the Fastframe app.

- [Former app README](react-tauri-readme.md)
- [Original specification](MVP_SPEC.md)
- [Original testing plan](TDD_PLAN.md)
- [Former phase plan](plan.md)
- [Original CurseForge integration plan](curseforge.md)

The last revision before retirement is `aebc62b`. Retrieve a removed source file from Git history, for example:

```bash
git show aebc62b:src/App.tsx
```

The shared Rust code now lives in `core/`. Its filesystem, metadata and provider regression tests remain part of current validation.
