# CurseForge API Verification Spike

Status: started with mocked fixtures. Live API verification still requires a CurseForge API key.

See also: [Source Lookup Live Smoke Checklist](source-lookup-live-smoke.md).

## Verified in code

- Sims 4 `gameId`: `7806`.
- Search endpoint shape: `GET /v1/mods/search?gameId=7806&searchFilter=...`.
- File endpoint shape: `GET /v1/mods/{projectId}/files`.
- API key is required and must be passed as `x-api-key` by the future live client.
- Tests parse mocked fixtures matching the expected CurseForge response shape.
- Tests do not call the live CurseForge API.
- CurseForge-specific parsing/request construction is isolated in `src-tauri/src/curseforge_client.rs`.

## Fields usable for matching

### From search results

Reliable enough for candidate display and weak matching:

- `id` -> `projectId`
- `name` -> candidate title
- `slug` -> slug similarity
- `links.websiteUrl` -> source URL to attach
- `logo.url` -> preview/cover image
- `authors[].name` -> author match when known

### From file metadata

Useful for stronger verification:

- `id` -> `fileId`
- `modId` -> project ID
- `displayName` -> uploaded file/archive display name
- `fileName` -> uploaded archive/file name
- `gameVersions[]` -> version-token evidence
- `hashes[]` -> possible exact/fuzzy fingerprint evidence

## Unknowns / live checks still needed

- Whether CurseForge hashes are compatible with local extracted `.package`/`.ts4script` files or only uploaded archives.
- Whether Sims 4 file metadata consistently includes meaningful `fileName` / `displayName`.
- Whether adding a Sims 4-specific class ID improves precision without hiding valid mods.
- Rate-limit behavior in practice.
- Whether search results for popular Sims 4 mods return stable slugs and website URLs.

## Matching implications

- Exact hash/fingerprint match should be high confidence only after live compatibility is verified.
- Exact archive/file name match is useful when the manager knows the imported archive name.
- Package/script basename evidence may need file metadata beyond uploaded archive names; if CurseForge only exposes archive names, local extracted file matching is weaker.
- Name-only matches should remain capped and never be marked verified.
