# Source Lookup Live Smoke Checklist

Use this checklist when validating CurseForge source auto-detect with a real API key. Do not download or update mods during this smoke test.

## Preconditions

- The app builds and launches locally.
- A real Sims 4 Mods folder is selected in Settings.
- The test mod is already installed locally, for example `McCmdCenter_AllModules_2026_2_0`.
- You have a CurseForge API key.

## API key setup

1. Open Settings.
2. Paste the CurseForge API key into the CurseForge API key field.
3. Save/close Settings.

Expected storage behavior:

- The key is stored only in app settings/localStorage.
- The key must not be written to any managed mod `meta.json`.
- Per-mod metadata may contain source provider/project/file details after user attach, but never the API key.

## Happy-path MCCC lookup

1. Select the game instance containing `McCmdCenter_AllModules_2026_2_0`.
2. Open the MCCC mod details.
3. Click `Find Source`.
4. Wait for candidates.

Expected candidate:

- Title: `MC Command Center`
- Source URL: `https://www.curseforge.com/sims4/mods/mc-command-center`
- Provider ID: `curseforge`
- Author: visible when returned by CurseForge, expected `Deaderpool`
- Project ID: visible, expected `551680` if CurseForge response is stable
- File ID: visible when file metadata is returned
- Preview image: should load or hide gracefully if the image URL fails
- Confidence: should remain conservative unless file evidence is strong
- Evidence list: shows each evidence kind, description, and weight
- Low-confidence warning: remains visible for candidates below 70

## Attach persistence check

1. Click `Attach` on the intended candidate.
2. Confirm the Source URL appears in mod details.
3. Rescan the selected instance.
4. Reopen mod details.

Expected persisted fields in the managed mod `meta.json`:

- `source`: `curseforge`
- `sourceUrl`: attached CurseForge URL
- `previewUrl`: candidate or resolved cover URL when available
- `sourceAttachment.providerId`: `curseforge`
- `sourceAttachment.projectId`
- `sourceAttachment.fileId` when available
- `sourceAttachment.sourceUrl`
- `sourceAttachment.title`
- `sourceAttachment.author` when available
- `sourceAttachment.confidence`
- `sourceAttachment.reasons[]`
- `sourceAttachment.evidence[]` with `kind`, `description`, and `weight`
- `sourceAttachment.attachedBy`: `user`
- `sourceAttachment.attachedAt`: ISO timestamp

Confirm again:

- No CurseForge API key is present in `meta.json`.
- Source URL and preview persist after rescan.
- The app did not download, update, delete, or auto-attach any mod.

## Error smoke checks

### Missing key

1. Clear the CurseForge API key in Settings.
2. Open a mod and click `Find Source`.

Expected:

- UI shows the missing API key hint.
- Development fixture fallback may still provide MCCC candidates for no-key UI testing.
- No API key is written to mod metadata.

### Bad key

1. Enter an invalid CurseForge API key.
2. Click `Find Source`.

Expected:

- Backend error code: `SOURCE_UNAUTHORIZED`.
- UI shows a lookup error message.
- No source candidate is attached automatically.

### Rate limit

If CurseForge rate limits the key:

- Backend error code: `SOURCE_RATE_LIMITED`.
- UI shows a lookup error message.
- No source candidate is attached automatically.

### Network failure

Temporarily disconnect network or block CurseForge API access, then click `Find Source`.

Expected:

- Backend error code: `SOURCE_NETWORK` or `SOURCE_PROVIDER_UNAVAILABLE` depending on transport response.
- UI shows a lookup error message.
- No source candidate is attached automatically.

### Malformed/changed provider response

If CurseForge response shape changes unexpectedly:

- Backend error code: `SOURCE_INVALID_RESPONSE`.
- UI shows a lookup error message.
- No source candidate is attached automatically.

## File metadata observations to record

For the MCCC candidate, inspect/log whether CurseForge file metadata includes:

- Uploaded archive names in `fileName` / `displayName`
- Useful version tokens in `gameVersions[]`
- Hash entries in `hashes[]`
- Stable latest file ordering
- Any extracted `.package` / `.ts4script` names

Record whether matching can be high-confidence from file evidence or must stay conservative for Sims 4 mods.
