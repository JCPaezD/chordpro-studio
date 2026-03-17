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

`ConfigRepository` owns config persistence. Missing config is treated as an empty partial config during startup, and the AppConfig directory is only created when config is explicitly written.

AppConfig is also the single source of truth for persisted UI preferences such as the User View conversion mode and the Playground model selection.

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

Current API key resolution:

1. environment variables
2. Vite-prefixed environment variables in browser development

Future UI phases may add manual entry or persisted user configuration if needed.

Examples:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_GEMINI_API_KEY`

---

## Developer Playground

The application includes a developer-only testing view called `Pipeline Playground`.

Purpose:

- inspect intermediate pipeline output
- test conversion models
- regenerate preview directly from editable `.cho`
- inspect retries and validation failures

It is intended for development and debugging, not for end-user workflow.
