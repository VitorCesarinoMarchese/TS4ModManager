# Native mod library

Mode: Operate.

User-approved direction: a mod-platform library closer to Deadlock Mod Manager and CurseForge. Photo cards are the default; a compact list is available. Keep the existing Fastframe desktop app and every management workflow.

First viewport: persistent navigation rail for all, installed and stored mods; compact game-folder header; library title and actual counts; search, state filters and card/list switch; large preview cards with names, authors when known, ownership and installed state; selected-mod inspector on wide windows. Import and settings remain easy to reach. Narrow windows collapse the rail and replace cards with details after selection.

Visual world: charcoal surfaces, warm off-white text, muted gold accent inspired by the Deadlock app, restrained borders, 12-point card corners, clear standard sans typography. Light mode translates the same hierarchy onto warm neutral surfaces. No fabricated discovery feed, downloads, profile or update counters.

Signature interaction: selecting a photo card highlights its border and opens a persistent inspector; switching installed/stored filters changes the collection without mutating files. Card/list switching preserves search and selected identity. Selection is immediate, with standard egui hover and keyboard-visible focus treatment. No custom selection animation is added.

Quality bar: https://deadlockmods.app/ and https://www.curseforge.com/sims4. Match their library density, photo prominence and navigation hierarchy, while keeping only real local management capabilities.

Verification: virtualized cards and list, real pointer input, filters intersect filename search, narrow navigation, photos/fallback, dark/light captures and existing management workflow checks. Native egui code is outside the HTML/CSS design detector.
