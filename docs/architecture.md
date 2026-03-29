# Architecture

## Platform Strategy

ChordPro Studio follows a desktop-first architecture.

Primary platform:

- desktop application built with Tauri

Reasons:

- local filesystem access
- local ChordPro CLI execution
- offline usage
- fast iteration for power users

Future platforms may include:

- mobile
- web client

---

## Core Principles

1. Local-first processing
2. AI-assisted workflows
3. Separation of concerns
4. Shared workspace state across UI modes
5. Extensible architecture

---

## System Layers

The system is divided into three main layers.

### 1. Core Domain

The core contains platform-independent models and logic.

Current domain areas:

- song
- songbook
- preferences
- validation

The core does not depend on:

- UI
- ChordPro CLI
- AI providers
- filesystem plugins

### 2. Services

Services implement functional logic on top of domain models.

Current services:

- `CleaningService`
- `ConversionService`
- `ChordProParser`
- `SongPipelineService`
- `SongbookService`

Responsibilities:

- clean raw song input
- convert cleaned text into ChordPro through an LLM provider
- validate ChordPro output before parsing
- normalize title and artist metadata from fresh LLM output before parsing
- clean chord-only separator lines from fresh LLM output before parsing
- parse ChordPro into the internal `Song` model
- load songbook folders and open `.cho` songs

### 3. Platform Adapters

Adapters connect the app to external systems.

Current adapters:

- LLM providers (`GeminiProvider`, `OpenAIProvider`)
- ChordPro CLI adapter (`TauriChordproAdapter`)
- filesystem adapters (`SongRepository`, `ConfigRepository`)

Responsibilities:

- HTTP access to LLM APIs
- desktop preview and PDF export through Tauri commands
- filesystem reads and writes for `.cho` files and config persistence
- request cancellation support for LLM-backed conversions through `AbortController`

---

## Processing Pipeline

The conversion pipeline is centralized in `SongPipelineService`.

Flow:

Raw input
-> `CleaningService`
-> `ConversionService`
-> `ChordProOutputValidator`
-> metadata normalization (`title`, `artist`)
-> safe chord-only separator cleanup
-> `ChordProParser`
-> internal `Song` model

`SongPipelineService.process()` currently returns:

- `cleanedText`
- `chordPro`
- `song`
- optional `retryLog`

The UI does not coordinate individual services directly.

Instead, the shared workspace orchestrates user actions and calls the pipeline as a single unit.

---

## Preview and Export Pipeline

Preview and export both rely on the same ChordPro renderer.

Preview flow:

ChordPro text
-> hash `chordProText` + effective render style
-> check persistent preview cache in `$APPCONFIG/cache/previews/<hash>.pdf`
-> on cache miss: Tauri `generate_preview` -> temporary `preview.cho` -> ChordPro CLI -> `preview.pdf` -> persist cached PDF
-> backend returns PDF bytes
-> frontend `Blob` URL
-> shared iframe-size-based fit composable computes the viewer URL (`fitv` / `fith` with A4-aware thresholds and a refresh token)
-> native WebView PDF viewer

Export flow:

ChordPro text
-> native Tauri save dialog
-> if `.pdf`: Tauri `export_pdf` -> ChordPro CLI -> requested PDF
-> if `.cho`: direct filesystem write without invoking the CLI

This keeps preview and exported PDF aligned on the same renderer. Before the CLI runs, the backend now also preprocesses explicit `{start_of_tab}` blocks with heuristic balanced splitting so long tabs fit more safely in one- and two-column layouts for preview, single-song export and songbook export without modifying the source `.cho` files. The preview cache only wraps that existing CLI path; it does not introduce a second renderer or an alternative preview pipeline.

All ChordPro CLI executions now also share the same global style configuration.

- runtime config path: bundled Tauri resource `resources/chordpro-studio/style.json`
- development fallback: repository `resources/chordpro-studio/style.json`
- applied to preview, single PDF export and songbook PDF export through the same backend command path
- runtime render preferences such as chord-diagram visibility and instrument selection are applied through that same shared command path; they do not introduce a second renderer

The bundled ChordPro runtime itself now stays isolated under `resources/chordpro` and is recreated from the official Windows release artifact instead of a local installation copy. Installer-only files such as `unins000.exe` and `unins000.dat` are not bundled because they are not required at runtime.

---

## Minimal Persistence

The canonical persisted song format is `.cho`.

Opening an existing song follows this flow:

`.cho`
-> `SongRepository.readSong()`
-> `ChordProParser`
-> shared `WorkspaceDocument`
-> preview refresh

The LLM pipeline is not used when opening an existing `.cho` file.

Saving an existing song follows this rule:

- if a song already has a `filePath`, normal `Save` overwrites that file and preserves its identity
- metadata may still derive a suggested `.cho` filename, but any change away from the current filename must be confirmed explicitly
- if the user chooses `Save as new file`, the app uses the native save dialog and switches the active `filePath` only after the new path is confirmed and written
- the original file is never deleted or silently replaced during that explicit rename flow
- Windows case-only renames are handled through a controlled temporary rename sequence only after the user has explicitly chosen the new filename

Songbook persistence follows this model:

- a songbook is a selected folder
- `SongbookService` scans the folder for `.cho` files
- entries are sorted alphabetically by `displayTitle`
- the last opened songbook path is stored in the Tauri AppConfig directory as `$APPCONFIG/config.json`
- the last explicitly opened song path is also stored there and restored only when it still exists inside the restored songbook

Current config content:

- `lastSongbookPath`
- `lastOpenedSongPath`
- `conversionMode`
- `playgroundModel`
- `geminiApiKey`
- `showChordDiagrams`
- `instrument`

`ConfigRepository` persists the full app config through Tauri backend commands. Missing config now resolves to a default object with `geminiApiKey: null`, and the backend creates `config.json` on first read if it does not exist yet.

`useAppConfig()` is the single frontend source of truth for persisted config. It loads config once at startup, keeps it in memory, and exposes persisted UI preferences such as the User View conversion mode, the Playground model selection, chord-diagram visibility, chord-diagram instrument selection and the last restored songbook state.

---

## Workspace and UI Modes

The app exposes two UI modes:

- `User`
- `Playground`

Both reuse the same shared workspace singleton returned by `useSongWorkspace.ts`.

The workspace owns:

- current raw input
- current `WorkspaceDocument`
- current preview state
- export feedback
- current songbook state
- the active conversion request lifecycle, including cancellation and stale-response invalidation

`WorkspaceDocument` represents the active song in the workspace.

Fields:

- `filePath`
- `fileName`
- `chordProText`
- parsed `song`
- `dirty`

This shared workspace design keeps state stable when switching between `User` and `Playground`. Views do not synchronize separate local states; they render and mutate the same workspace instance.

The current document (`.cho` in memory) is treated as the single source of truth.
After reconversion of an already opened `.cho`, the workspace preserves the active file path and replaces the parsed song snapshot so UI metadata and later save behavior continue to derive from the same document state.
Any action that replaces it is considered destructive and must go through the unified confirmation flow.
Current protected actions are:

- opening a song from the songbook
- triggering a new conversion from `Convert`
- closing the application window

Songbook performance mode keeps reusing that same workspace state. It does not create a second reader-specific store; it only changes layout and navigation rules in `User`, and deliberately bypasses unsaved-change blocking while browsing songs in that consumption-focused mode.

---

## UI Layout

The application shell is constrained to the viewport height.

Layout rules:

- the header remains fixed and outside the scroll flow
- the app does not use global page scroll
- the main panels share the remaining available height
- each panel manages its own internal scrolling
- UI states such as empty, loading and content must not change panel height
- content components such as textareas, PDF preview frames and lists must not define layout height
- `User` may temporarily switch the shared app shell into an immersive low-padding variant for Songbook performance mode without changing application architecture

---

## Songbook UI Structure

The current user-facing layout is:

`| nav | left panel | preview |`

Left navigation:

- `Songbook`
- `Convert`

The preview panel remains visible while the left panel changes.

`Convert` panel:

- raw input editor
- conversion action
- collapsible `.cho` editor for refinement

`Songbook` panel:

- folder toolbar
- song list
- `.cho` editor for the selected song
- optional performance mode inside `User`, reusing the same workspace and preview pipeline with an overlay song list and maximized PDF viewer
- song lists in both normal Songbook and performance mode keep the keyboard selection visible through local UI-managed auto-scroll, without adding new shared state or changing workspace behavior
- performance mode keyboard flow remains local to the view, including list focus handoff through `Enter`, overlay close with `Esc`, and optional `F11` toggle entry when Songbook is available
- normal preview panels reuse the shared buffered preview swap already driven from `UserView`, while performance mode keeps its own local dual-iframe buffer so fit refreshes can pass through a hidden frame and force a real `about:blank -> fitted PDF` navigation without flashing the visible viewer

---

## LLM Integration

The application integrates Large Language Models through a provider abstraction layer.

Supported providers:

- OpenAI
- Gemini

The current runtime conversion prompt lives in:

- `app/prompts/conversion.prompt.md`

Prompt variables currently used:

- `{{song_text}}`
- `{{user_preferences}}`

Prompt loading behavior:

- frontend `PromptLoader` resolves prompts from bundled `app/prompts/*.prompt.md` assets only
- no frontend filesystem fallback is used for prompt loading

Current runtime API key handling:

- the Tauri backend owns `config.json` in the app config directory
- frontend config is loaded once through `useAppConfig()` and kept in memory
- the shared workspace receives the current Gemini API key through dependency injection
- providers do not read config directly

Environment-based keys may still be used for development-only fallback paths such as explicit OpenAI testing, but the normal User workflow now depends on the persisted Gemini key managed in the app UI.

---

## Developer Playground

The application includes a developer-only testing view called `Pipeline Playground`.

Purpose:

- inspect intermediate pipeline output
- test conversion models
- regenerate preview directly from editable `.cho`
- inspect retries and validation failures

It is intended for development and debugging, not for end-user workflow. The Playground is now exposed only in DEV builds; production builds always open the `User` view, do not render a Playground toggle, and also remove the extra `Workspace` label that only exists to distinguish the two modes during development.

