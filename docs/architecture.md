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

---

## Processing Pipeline

The conversion pipeline is centralized in `SongPipelineService`.

Flow:

Raw input
-> `CleaningService`
-> `ConversionService`
-> `ChordProOutputValidator`
-> metadata normalization (`title`, `artist`)
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
-> Tauri `generate_preview`
-> temporary `preview.cho`
-> ChordPro CLI
-> `preview.pdf`
-> backend returns PDF bytes
-> frontend `Blob` URL
-> native WebView PDF viewer

Export flow:

ChordPro text
-> native Tauri save dialog
-> if `.pdf`: Tauri `export_pdf` -> ChordPro CLI -> requested PDF
-> if `.cho`: direct filesystem write without invoking the CLI

This keeps preview and exported PDF aligned on the same renderer.

All ChordPro CLI executions now also share the same global style configuration.

- runtime config path: bundled Tauri resource `resources/chordpro-studio/style.json`
- development fallback: repository `resources/chordpro-studio/style.json`
- applied to preview, single PDF export and songbook PDF export through the same backend command path

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

Songbook persistence follows this model:

- a songbook is a selected folder
- `SongbookService` scans the folder for `.cho` files
- entries are sorted alphabetically by `displayTitle`
- the last opened songbook path is stored in the Tauri AppConfig directory as `$APPCONFIG/config.json`

Current config content:

- `lastSongbookPath`
- `conversionMode`
- `playgroundModel`
- `geminiApiKey`

`ConfigRepository` persists the full app config through Tauri backend commands. Missing config now resolves to a default object with `geminiApiKey: null`, and the backend creates `config.json` on first read if it does not exist yet.

`useAppConfig()` is the single frontend source of truth for persisted config. It loads config once at startup, keeps it in memory, and exposes persisted UI preferences such as the User View conversion mode and the Playground model selection.

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

`WorkspaceDocument` represents the active song in the workspace.

Fields:

- `filePath`
- `fileName`
- `chordProText`
- parsed `song`
- `dirty`

This shared workspace design keeps state stable when switching between `User` and `Playground`. Views do not synchronize separate local states; they render and mutate the same workspace instance.

The current document (`.cho` in memory) is treated as the single source of truth.
Any action that replaces it is considered destructive and must go through the unified confirmation flow.
Current protected actions are:

- opening a song from the songbook
- triggering a new conversion from `Convert`
- closing the application window

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

