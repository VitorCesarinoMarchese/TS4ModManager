# CurseForge API Research

## Overview

The CurseForge REST API exposes CurseForge catalog data such as games, categories, mods/projects, files, and fingerprints. The official REST API base URL is:

```text
https://api.curseforge.com
```

API keys are generated in the CurseForge for Studios developer console:

```text
https://console.curseforge.com/
```

For The Sims 4 mod searches, use `gameId=78062`. If you are building production software, verify this against an authenticated `/v1/games` lookup because CurseForge's REST docs document the `gameId` parameter but do not publish a static game-ID table on the searched documentation page.

## Authentication

Pass the API key on every request using the `x-api-key` HTTP header. The official documentation names the auth scheme `API_KEY` and specifies the parameter name as `x-api-key`, in the request header.

```http
x-api-key: YOUR_API_KEY
```

No `Bearer` prefix is documented; the header value is the API key itself.

## Searching for Sims 4 Mods

Endpoint:

```text
GET https://api.curseforge.com/v1/mods/search
```

Important documented query parameters for the search endpoint:

| Parameter | Required | Description |
|---|---:|---|
| `gameId` | Yes | Filter by game ID. Use `78062` for The Sims 4. |
| `classId` | No | Filter by section ID, discoverable via Categories. |
| `categoryId` | No | Filter by category ID. |
| `categoryIds` | No | List of category IDs; overrides `categoryId`; maximum 10 IDs. |
| `gameVersion` | No | Filter by one game-version string. |
| `gameVersions` | No | List of game-version strings; overrides `gameVersion`; docs state maximum 4 values. |
| `searchFilter` | No | Free-text search in mod name and author. |
| `sortField` | No | `ModsSearchSortField` enum value. |
| `sortOrder` | No | `asc` or `desc`. |
| `modLoaderType` | No | Filter by mod loader; must be coupled with `gameVersion`. Mostly relevant to games like Minecraft. |
| `modLoaderTypes` | No | List of mod-loader types; overrides `modLoaderType`; maximum 5 values. |
| `gameVersionTypeId` | No | Filter to mods containing files tagged with versions of this game-version-type ID. |
| `authorId` | No | Filter to mods where the author is a member. |
| `primaryAuthorId` | No | Filter to mods owned by the primary author. |
| `slug` | No | Filter by slug; with `classId` this can produce a unique result. |
| `index` | No | Zero-based first result index; `index + pageSize <= 10,000`. |
| `pageSize` | No | Number of results; default/maximum is 50. |

### `curl` example

```bash
curl -G 'https://api.curseforge.com/v1/mods/search' \
  -H 'Accept: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  --data-urlencode 'gameId=78062' \
  --data-urlencode 'searchFilter=ui cheats' \
  --data-urlencode 'pageSize=10'
```

### Python `requests` example

```python
import requests

API_KEY = "YOUR_API_KEY"

response = requests.get(
    "https://api.curseforge.com/v1/mods/search",
    headers={
        "Accept": "application/json",
        "x-api-key": API_KEY,
    },
    params={
        "gameId": 78062,
        "searchFilter": "ui cheats",
        "pageSize": 10,
    },
    timeout=30,
)
response.raise_for_status()

payload = response.json()
for mod in payload["data"]:
    print(mod["id"], mod["name"], mod["links"]["websiteUrl"])
```

## Response Fields

A successful search response is a JSON object with `data` and `pagination` fields. `data` is an array of `Mod` objects.

| Field | Type | Meaning |
|---|---|---|
| `data` | array of `Mod` | Search results. |
| `pagination.index` | integer | Zero-based index used for this page. |
| `pagination.pageSize` | integer | Requested/returned page size. |
| `pagination.resultCount` | integer | Number of results in this response. |
| `pagination.totalCount` | integer | Total matching results available within API limits. |
| `data[].id` | integer | CurseForge mod/project ID. |
| `data[].gameId` | integer | Game ID this mod belongs to. |
| `data[].name` | string | Human-readable mod name. |
| `data[].slug` | string | URL slug for the mod. |
| `data[].links.websiteUrl` | string | CurseForge website URL for the mod. |
| `data[].downloadCount` | integer | Total downloads for the mod. |
| `data[].summary` | string | Short mod summary. |
| `data[].authors` | array | Mod author records. |
| `data[].latestFiles` | array | Latest file records for the mod. |
| `data[].dateModified` | string/date-time | Last modification timestamp. |
| `data[].isAvailable` | boolean | Whether the mod is available for search. |

## Error Handling

CurseForge's searched REST documentation explicitly lists `400` and `500` for `GET /v1/mods/search`; other endpoints also list `404`, and fingerprint endpoints list `503`. The docs require API-key authentication but the searched REST page did not explicitly document `401`, `403`, or `429` response rows.

| HTTP status | Meaning | Recommended action |
|---:|---|---|
| `400 Bad Request` | Request was invalid, e.g. missing/invalid query parameter. | Do not retry unchanged. Fix parameters such as `gameId`, `pageSize`, `index`, or enum values. |
| `401 Unauthorized` | ⚠️ Not officially documented on the searched REST page. Generally means missing/invalid authentication. | Check that `x-api-key` is present and correct. Do not retry blindly. |
| `403 Forbidden` | ⚠️ Not officially documented on the searched REST page. Generally means credentials are not allowed to access the resource. | Check API-key permissions/account status; request access if needed. |
| `404 Not Found` | Documented on some endpoints; requested resource does not exist. | Do not retry unchanged. Verify IDs, slugs, and endpoint path. |
| `429 Too Many Requests` | ⚠️ Not officially documented — verify before production use. Generally means rate limit exceeded. | Retry after `Retry-After` if supplied; otherwise use exponential backoff and reduce request rate. |
| `500 Internal Server Error` | Documented server-side failure. | Retry with exponential backoff; log request details. |
| `503 Service Unavailable` | Documented on fingerprint endpoints; service temporarily unavailable. | Retry with backoff; treat as transient. |
| Other `5xx` | Server/proxy/transient failure. | Retry with capped exponential backoff and jitter; alert if persistent. |

## Rate Limiting

⚠️ Not officially documented — verify before production use.

I could not confirm an official CurseForge REST API limit such as requests per second or requests per minute from the searched official REST documentation. I also could not confirm official `Retry-After` behavior for CurseForge `429` responses. For production clients, implement conservative throttling, cache responses where allowed, and handle `429` defensively.

Example Python helper that honors `Retry-After` when present, otherwise uses exponential backoff with jitter:

```python
import random
import time
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

import requests


def retry_after_seconds(value):
    if not value:
        return None
    try:
        return max(0, int(value))
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            return max(0, int((retry_at - datetime.now(timezone.utc)).total_seconds()))
        except Exception:
            return None


def get_with_backoff(url, *, headers, params=None, max_attempts=5):
    for attempt in range(max_attempts):
        response = requests.get(url, headers=headers, params=params, timeout=30)

        if response.status_code != 429:
            response.raise_for_status()
            return response

        server_delay = retry_after_seconds(response.headers.get("Retry-After"))
        backoff_delay = min(60, (2 ** attempt) + random.uniform(0, 1))
        delay = server_delay if server_delay is not None else backoff_delay
        time.sleep(delay)

    raise RuntimeError("Exceeded retry attempts after repeated 429 responses")


result = get_with_backoff(
    "https://api.curseforge.com/v1/mods/search",
    headers={
        "Accept": "application/json",
        "x-api-key": "YOUR_API_KEY",
    },
    params={
        "gameId": 78062,
        "searchFilter": "ui cheats",
        "pageSize": 10,
    },
)
print(result.json())
```

## References

- CurseForge REST API documentation — base URL, authentication, `/v1/mods/search`, parameters, response schemas, and documented endpoint response codes: https://docs.curseforge.com/rest-api/ (accessed 2026-05-14)
- CurseForge for Studios developer console — API-key generation location referenced by official docs: https://console.curseforge.com/ (accessed 2026-05-14)
- CurseForge The Sims 4 public catalog page — confirms The Sims 4 is a CurseForge game catalog: https://www.curseforge.com/sims4 (accessed 2026-05-14)
- RFC 7231 HTTP/1.1 Semantics and Content — standard meanings for `400`, `401`, `403`, `404`, `500`, and `503`: https://www.rfc-editor.org/rfc/rfc7231 (accessed 2026-05-14)
- RFC 6585 Additional HTTP Status Codes — standard meaning for `429 Too Many Requests`: https://www.rfc-editor.org/rfc/rfc6585 (accessed 2026-05-14)
