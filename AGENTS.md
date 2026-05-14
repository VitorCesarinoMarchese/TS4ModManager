# Agent Rules

Project-specific rules for future coding agents working on TS4 Mod Manager.

## Source lookup and CurseForge safety

- Do not paste, request, or store CurseForge API keys in chat.
- Store local API keys only in untracked `.env` or app settings/localStorage.
- `.env` / `.env.*` must stay ignored by git.
- Never store CurseForge API keys in per-mod `meta.json`.
- Do not download mods.
- Do not update mods.
- Do not auto-attach sources silently.
- Always require explicit user confirmation before saving source candidates.
- Do not treat weak/name-only matches as verified.
- Do not invent source URLs or source candidates.
- If CurseForge API returns no real candidates, show no candidates.
- Candidate URLs must come from real provider/API data, not guessed slugs.
- Manual/search shortcut links, if added later, must be clearly labeled and not attachable as verified candidates.
- Keep CurseForge integration isolated behind source/provider/client modules.
- Keep the app local-first.

## Metadata rules

- Store mod metadata in each managed mod's `meta.json`.
- Persist rich source attachment metadata only after user attach.
- Rich source attachment metadata may include:
  - provider ID
  - source URL
  - title
  - author
  - project ID
  - file ID
  - confidence
  - reasons/evidence
  - `attachedBy: "user"`
  - `attachedAt`
- Do not store API keys in `meta.json`.

## UI/image behavior

- Broken candidate images should hide.
- Broken mod card images should fall back to `No Preview`.
- Preview images should use `referrerPolicy="no-referrer"`.
- Low-confidence warnings must remain visible for weak candidates.

## Filesystem safety

- Never permanently delete user files.
- Never delete unmanaged files.
- Safe removal must move files to trash where applicable.
- App-created symlinks may be removed only when ownership/safety checks pass.

## Development workflow

- Follow TDD: write/update failing tests before implementation.
- Keep commits small and atomic.
- Commit after each logical change.
- Run relevant targeted tests after each change.
- Run full validation before final report:
  - `npm run test:coverage`
  - `cargo test --manifest-path src-tauri/Cargo.toml`
  - `npm run build`
  - `cargo check --manifest-path src-tauri/Cargo.toml --features tauri-app`
