# Native catalog pilot

Historical record from before the React/Tauri app was retired. Source paths and validation commands describe that revision. The current app lives in `native/`, with its Rust library in `core/`. See the [current setup instructions](development.md).


The pilot keeps the existing Rust core and adds a separate `native/` executable. It reads game instances, scans catalogs, searches names and filenames, and shows mod details. File-management actions remain in the existing app during this evaluation.

The scanner first needs to group managed files by their owning mod ID, rather than the containing folder, and expose enabled state. External files keep their folder/filename grouping. Two managed mods or a managed mod and external files can share a game folder without sharing identity.

The UI uses the current app's restrained green accent, light/dark surfaces, and familiar desktop controls. A virtualized catalog list and a details pane prioritize scanning large collections. Details collapse to a separate view in narrow windows. Loading, error, empty, and no-match states explain the next action. Existing source URLs are display-only and the pilot performs no provider requests.

Caller usage:

```rust
let generation = catalog.begin_scan(root.clone());
jobs.submit(Request::Scan { generation, root, managed_root });
// Each native frame drains completed work without waiting.
catalog.accept_scan(generation, result);
catalog.search(query);
catalog.select(catalog_index);
```

`catalog.rs` owns generations, typed managed/external identities, cached search text, filtering, and stable selection. `worker.rs` owns one background thread and one replaceable pending request. The UI submits complete requests and accepts results only for the current generation. The mutex protects only a request slot, never filesystem work. Closing the window wakes the worker and discards queued requests without joining a running scan on the UI thread.

`ui.rs` renders egui widgets and virtualized mod/file rows. `main.rs` validates command-line inputs and launches the window or a headless catalog inspection. The worker calls core detection/validation/scanning directly. Managed paths are computed without the directory-creating runtime helpers.

Two design candidates were compared. A serial worker scored higher for its single intent-generation rule, typed identities, and smaller interface. A bounded per-request worker design allowed independent discovery and scanning but required cross-lane invalidation and more lifecycle code. The independent design judge recommended the serial worker, with the losing candidate's one-slot pending replacement policy. This bounds both threads and queued scan requests. A running obsolete scan can still delay the newest scan; it cannot replace its results.

Regression tests must fail before implementing scanner ownership and model generations. Deterministic model tests cover stale success/error results, same-instance refresh, Unicode filename search, and selection identity. Worker tests cover pending-request replacement and real temporary-file scans without creating managed storage. A fixture script exercises the actual executable, verifies catalog counts/search, checks input files remain unchanged, and records timing for repeatable catalogs. Native screenshots and headless egui interaction checks complement the script. Headless timing does not prove desktop scroll feel or comparative performance.
