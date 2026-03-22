# Development Notes

This document records development-time decisions, assumptions and items that require later review.

## Assumptions Policy

When implementing features, the system may occasionally need to make assumptions.

Any assumption made during development must be recorded in this document under an **Assumptions** section.

This ensures that important design decisions are not silently introduced without later review.

Each assumption entry should include:

- date
- context
- assumption made
- reason for the assumption
- whether it requires later validation

## Architecture Authority

Architecture decisions must follow the documentation in:

- docs/architecture.md
- docs/domain-model.md
- docs/mvp.md

If an implementation requires changing the architecture, the change must first be proposed and documented before modifying the code structure.

## Documentation First Principle

Major design decisions should be documented before implementation.

If a change affects:

- architecture
- domain model
- pipeline design
- data persistence

the documentation must be updated first.

## Assumptions

- date: 2026-03-08
- context: moving the conversion runtime prompt from `docs/prompts.md` to `app/prompts/conversion.prompt.md`
- assumption made: the runtime prompt content starts at `Actúa...` and ends at `[PEGA AQUÍ TU CANCIÓN]`, excluding the `prompts.md` heading and `## Prompt Storage Strategy` section
- reason for the assumption: those parts are documentation metadata and storage guidance, not runtime prompt text
- whether it requires later validation: yes

- date: 2026-03-08
- context: fixing encoding in `app/prompts/conversion.prompt.md`
- assumption made: mojibake shown in terminal output is caused by console display encoding, so UTF-8 byte validation is the source of truth for correctness
- reason for the assumption: direct UTF-8 decoding checks confirmed correct accented content while console rendering remained inconsistent
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing `ChordProParser` in `app/src/services/parser/ChordProParser.ts`
- assumption made: parser output must follow the currently implemented TypeScript domain interfaces (which do not yet include all fields listed in `docs/domain-model.md`), and unknown section labels from `{comment: ...}` are mapped to section type `custom`
- reason for the assumption: architecture and domain docs are ahead of the current code model, and parser must still emit a valid `Song` object compatible with existing interfaces
- whether it requires later validation: yes

- date: 2026-03-08
- context: aligning `ChordProParser` output strictly with `docs/domain-model.md`
- assumption made: parser runtime output should prioritize documentation shape (`Line` with only `segments`, `Segment` with `lyric`) even though current TypeScript interfaces are not yet fully aligned
- reason for the assumption: task explicitly requires strict domain-model alignment and also forbids modifying existing domain interfaces in this change
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing `PromptLoader` in `app/src/utils/PromptLoader.ts`
- assumption made: prompt lookup should support `app/prompts` from repository root and a runtime override via `CHORDPRO_PROMPTS_DIR`; unresolved template variables should remain unchanged in rendered output
- reason for the assumption: this keeps runtime behavior deterministic across Node/Tauri contexts while avoiding silent data loss from missing render variables
- whether it requires later validation: no, superseded by the 2026-03-21 bundled-only prompt loading change

- date: 2026-03-08
- context: implementing `OpenAIProvider` and `GeminiProvider` in `app/src/adapters/llm/`
- assumption made: initial provider calls target OpenAI `POST /v1/responses` and Gemini `v1beta ... :generateContent`, extracting plain text from `output_text`/content parts
- reason for the assumption: this is a simple deterministic HTTP integration that satisfies current MVP requirements without external SDK dependencies
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing conservative `CleaningService` in `app/src/services/cleaning/CleaningService.ts`
- assumption made: known website boilerplate removal is limited to exact, line-level matches from the documented examples to avoid deleting possible musical text; HTML cleanup removes tag markup but preserves remaining visible characters
- reason for the assumption: conservative cleaning must prioritize musical information preservation and alignment safety
- whether it requires later validation: yes

- date: 2026-03-08
- context: updating `app/prompts/conversion.prompt.md` for PromptLoader variables
- assumption made: the new `User preferences` block should be appended near the final input area, immediately before `{{song_text}}`, while preserving all existing conversion rules and instruction sections
- reason for the assumption: architecture docs define both `{{song_text}}` and `{{user_preferences}}` as current prompt variables but do not mandate an exact insertion line
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing `app/src/services/conversion/ConversionService.ts`
- assumption made: new conversion flow returns raw ChordPro text from the provider and coexists temporarily with older placeholder/contracts that still model conversion as `Song`
- reason for the assumption: task requires prompt-driven LLM conversion output as string and explicitly excludes parsing from this service
- whether it requires later validation: yes

- date: 2026-03-08
- context: cleanup of scaffold-era services compatibility layer
- assumption made: shared `app/src/services/contracts.ts` and placeholder wrapper exports are obsolete now that concrete `CleaningService` and `ConversionService` are implemented, while `analysis` should remain contract-only until a real implementation exists
- reason for the assumption: architecture now documents concrete service flow, and legacy wrappers introduced type/API drift from real implementations
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing developer Pipeline Playground view
- assumption made: the playground should prefer `OpenAIProvider` with model `gpt-4.1-mini`, fall back to `GeminiProvider` with model `gemini-1.5-flash`, and show a runtime error if no API key is configured
- reason for the assumption: the task requires reusing existing service implementations and opening directly into a developer debugging view without adding new configuration UI
- whether it requires later validation: no, superseded later by the shared workspace model and updated Gemini selection behavior documented in the 2026-03-14 and 2026-03-15 notes

- date: 2026-03-08
- context: making PromptLoader compatible with the developer Playground running in the Vue app
- assumption made: prompt files should be loaded from bundled `app/prompts/*.prompt.md` at runtime in the browser build, with filesystem reads kept only as a fallback for Node-like environments
- reason for the assumption: static Node imports break Vite browser builds once ConversionService is used from UI code
- whether it requires later validation: no, superseded by the 2026-03-21 bundled-only prompt loading change

- date: 2026-03-21
- context: removing the frontend PromptLoader filesystem fallback after validating the embedded prompt path in the release workflow
- assumption made: the frontend should resolve prompts only from bundled `app/prompts/*.prompt.md` assets, and local filesystem fallback through Node-specific modules is unnecessary for the current desktop app workflow
- reason for the assumption: this removes the Vite browser warning, keeps prompt loading aligned with the actual packaged runtime, and preserves the validated conversion flow without adding backend complexity
- whether it requires later validation: yes

- date: 2026-03-08
- context: fixing repository-level npm command failures
- assumption made: npm commands are expected to be executed from repository root, so root workspace scripts should proxy to `app/` (`npm install`, `npm run build`, `npm run dev`)
- reason for the assumption: failures were caused by missing root `package.json`, while the functional app already lived under `app/`
- whether it requires later validation: yes

- date: 2026-03-08
- context: enabling LLM API key detection in Vite dev browser runtime
- assumption made: browser-side development uses `VITE_OPENAI_API_KEY` / `VITE_GEMINI_API_KEY` from `app/.env.local`, while Node/Tauri runtime keeps `OPENAI_API_KEY` / `GEMINI_API_KEY` via `process.env`
- reason for the assumption: Vite only exposes prefixed variables to client code and does not provide raw process environment variables in browser runtime
- whether it requires later validation: yes

- date: 2026-03-08
- context: fixing missing API key detection in the Pipeline Playground
- assumption made: repository-root `.env.local` is the canonical development env file, so Vite should load env values from repo root (`envDir: \"..\"`) while providers resolve `process.env` first and then `import.meta.env`
- reason for the assumption: the active developer workflow runs npm commands from repository root and already stores Vite keys in root `.env.local`
- whether it requires later validation: yes

- date: 2026-03-08
- context: resolving Gemini model-not-found errors in the Playground
- assumption made: model IDs should be selected from live `v1beta/models` discovery for the active API key, and `gemini-flash-latest` is the stable text-generation alias to use for this project
- reason for the assumption: hardcoded legacy model names were not available to the current key/version and caused runtime 404 failures
- whether it requires later validation: yes

- date: 2026-03-10
- context: adding retry handling for temporary Gemini failures in `GeminiProvider`
- assumption made: Gemini requests should attempt 1 initial request plus up to 3 retries for HTTP 429, HTTP 503 and network failures, using exponential backoff (500ms, 1000ms, 2000ms), and propagate `retryLog` to the Playground for debugging whether the request eventually succeeds or fails
- reason for the assumption: temporary provider errors should not fail the pipeline immediately, and retry visibility is necessary to debug instability from the developer Playground without relying on browser console logs
- whether it requires later validation: yes

- date: 2026-03-10
- context: redesigning the runtime conversion prompt for pipeline use
- assumption made: the conversion LLM must behave as a deterministic transformer that returns only valid ChordPro and must not switch into conversational or metadata-request behavior
- reason for the assumption: the pipeline now depends on automatic downstream parsing and cannot safely process explanatory or blocking responses
- whether it requires later validation: yes

- date: 2026-03-11
- context: refining chord alignment behavior in `app/prompts/conversion.prompt.md`
- assumption made: chord alignment issues from chord-line plus lyric-line input can be resolved at the prompt layer by explicitly treating source text as monospaced for column calculation while forcing final lyric lines to start at column 0 with no artificial indentation
- reason for the assumption: manual tests with real chord sheets showed that explicit prompting materially improved chord placement and removed indentation artifacts without adding a separate deterministic alignment step
- whether it requires later validation: yes

- date: 2026-03-10
- context: fixing inline ChordPro parsing in `app/src/services/parser/ChordProParser.ts`
- assumption made: each inline chord token applies to the lyric text that follows it until the next chord or end of line, while text before the first chord remains an unchorded segment
- reason for the assumption: this matches ChordPro inline notation semantics and fixes the documented BUG-08 parser inversion
- whether it requires later validation: yes

- date: 2026-03-10
- context: adding LLM output validation before parsing in `SongPipelineService`
- assumption made: the safest MVP boundary is to place `ChordProOutputValidator` between `ConversionService` and `ChordProParser` in the pipeline (`CleaningService -> ConversionService -> ChordProOutputValidator -> ChordProParser`) and reject model output unless it contains both basic ChordPro structure (tags plus inline chords) and none of the known non-ChordPro patterns such as markdown fences or explanatory lead-in text
- reason for the assumption: parser errors and contaminated Song models are easier to prevent at the pipeline boundary than to repair after parsing, and surfacing `rawOutput` there gives the Playground enough context for debugging failed conversions
- whether it requires later validation: yes

- date: 2026-03-11
- context: implementing Tauri preview and PDF export around the ChordPro CLI
- assumption made: the bundled ChordPro runtime will live under `resources/chordpro`, preview temp files will live in the application cache directory as `preview/preview.cho` and `preview/preview.pdf`, and the frontend will render that generated PDF through the native WebView PDF viewer using a browser `Blob` URL created from backend-returned PDF bytes
- reason for the assumption: the MVP needs preview and export to use the exact same ChordPro renderer output, and local asset URLs proved unreliable for embedded PDF preview in the current desktop runtime
- whether it requires later validation: yes

- date: 2026-03-14
- context: improving Playground iteration speed for conversion and preview debugging
- assumption made: the developer Playground should prefer Gemini when a Gemini key is available, default the selectable Gemini model to `gemini-2.5-flash`, preserve environment overrides through `GEMINI_MODEL` / `VITE_GEMINI_MODEL`, allow direct preview generation from the editable current `.cho` text by reusing the existing `generate_preview` backend command without re-running the LLM pipeline, and clear previous generated outputs before each run or when `Clear all` is used while preserving the raw input field
- reason for the assumption: Playground usage prioritizes fast iteration and direct CLI preview debugging, while `gemini-2.5-flash` is a fast but more reliable default than flash-lite for the conversion step and explicit result clearing makes each run easier to inspect
- whether it requires later validation: yes


- date: 2026-03-21
- context: normalizing LLM-generated `title` and `artist` metadata before parsing in `SongPipelineService`
- assumption made: metadata normalization should apply only to fresh conversion output by rewriting the converted ChordPro `{title: ...}` and `{artist: ...}` directives before parsing, while existing `.cho` files and later manual metadata edits must remain untouched
- reason for the assumption: this keeps the change local to the LLM pipeline, aligns parsed metadata with filename suggestions derived from ChordPro tags, and avoids introducing migration or edit-time side effects
- whether it requires later validation: no, validated on 2026-03-21 with messy metadata conversion tests and unchanged existing `.cho` loading

- date: 2026-03-21
- context: handling chord-only separator lines such as `[G] - [Am] - [Em]` in LLM-generated ChordPro before parsing
- assumption made: separator cleanup should run only on lines made exclusively of bracketed chord tokens, `-` separators and whitespace, rewriting them into simple chord-only lines while leaving any mixed lyric/chord content untouched
- reason for the assumption: this complements the prompt instruction with a minimal safe guardrail, removes separator artifacts without attempting alignment or structural inference, and preserves existing `.cho` loading behavior
- whether it requires later validation: no, validated on 2026-03-21 with successful chord-only, mixed-content and full-flow manual tests

- date: 2026-03-22
- context: fixing BUG-15 around metadata synchronization and filename normalization after reconversion and save
- assumption made: the active `WorkspaceDocument` should remain the single source of truth after reconversion, while saving an existing `.cho` should only rename conservatively when the normalized target path is available and conflict-free
- reason for the assumption: this resolves editor/song list desynchronization without introducing aggressive auto-rename behavior, and keeps Windows case-only normalization safe through a temporary rename step plus Tauri `fs:allow-rename`
- whether it requires later validation: no, validated on 2026-03-22 with successful editor save, unsaved-changes modal save and Preview `.cho` export tests

- date: 2026-03-22
- context: adding user-driven conversion abort support in `User` and `Playground`
- assumption made: conversion cancellation should use real `AbortController` support in the LLM providers when available, while the shared workspace still invalidates late responses through a request id so aborted or stale results never affect UI state
- reason for the assumption: this keeps the feature safe even if transport cancellation is delayed, avoids extra pipeline refactors, and gives both views a single source of truth for active conversion state
- whether it requires later validation: no, validated on 2026-03-22 with successful abort, late-response ignore, rerun and repeated-click manual tests

## Preview and Export Notes

Preview generation now follows this flow:

`SongPipelineService` result (`chordPro`)
-> Tauri `generate_preview`
-> write `preview.cho` in the app cache directory
-> execute bundled ChordPro CLI
-> generate `preview.pdf`
-> return the PDF path plus PDF bytes to the frontend
-> create a browser `Blob` URL
-> load it through the native WebView PDF viewer

PDF export now follows this flow:

frontend native save dialog
-> suggest filename from `{artist}` / `{title}` metadata when available (`artist - title`, `artist` or `title`, else `song`)
-> if `.pdf` selected: Tauri `export_pdf`
-> write temporary `.cho`
-> execute bundled ChordPro CLI with `--output`
-> generate the requested PDF
-> if `.cho` selected: write current ChordPro text directly to disk without invoking the CLI
-> if the active document already exists on disk: keep overwrite behavior first, then apply conservative filename normalization only when a safe target path is available

Songbook PDF export now follows this flow:

frontend songbook action
-> read `.cho` files directly from the active songbook folder
-> sort them alphabetically by filename
-> native save dialog
-> Tauri `export_songbook_pdf`
-> execute bundled ChordPro CLI with multiple input files and `--output`
-> generate a single PDF for the full songbook

Export feedback behavior:

- export success or failure is shown directly in the UI near the export action in both `User` and `Playground`
- success messages use the saved filename when available
- export and preview feedback messages persist until the next user action clears them (`run pipeline`, `refresh preview`, `export again`, `clear`, etc.)
- shared workspace cleanup is split between `clearGeneratedState()` (results only) and `clearAllState()` (raw input plus generated state) so `User` and `Playground` can choose the correct behavior without duplicating reset logic
- Preview `.cho` export now follows the same conservative safe-rename rule used by direct editor save when it targets the current document

Preview failure behavior:

- if preview generation fails, the previous valid preview remains visible
- the frontend shows the backend error message returned by the failed preview command
- while a new preview is being generated, the shared workspace exposes a dedicated preview-loading state so both `User` and `Playground` show either a centered loading placeholder (when no preview exists yet) or a soft overlay above the current PDF without clearing the previous valid preview
- preview errors are cleared at the start of a new preview generation so stale failure messages do not survive a later successful preview
- User View `.cho` editor now refreshes preview with a debounced non-blocking path and keeps the current iframe/PDF visible while a new blob URL is loading
- the User View preview now uses a local dual-iframe buffer with a short delayed swap so the next PDF can load before becoming visible, reducing flicker without changing the underlying native viewer approach
- even with the buffered swap, the native PDF viewer can still introduce small temporary editor stalls while a refreshed document is being loaded into the WebView
- the current native PDF viewer approach still performs a full document reload when the iframe `src` changes; reducing that further would require a custom viewer outside the current architecture
- Songbook performance mode in `User` now switches the app shell into an immersive low-padding layout, keeps navigation controls local to the view, and uses a pragmatic PDF fit heuristic (`fith` in tall previews, `fitv` in wide previews) because the native Edge/WebView PDF viewer did not apply `#view=fit` reliably in manual testing
- keyboard navigation in performance mode intentionally remains best-effort when focus stays in the app; once focus moves inside the native PDF viewer iframe, its own input handling takes precedence and the app does not try to steal focus back

Bundled CLI expectation:

- repository/development path: `resources/chordpro/chordpro(.exe)`
- packaged app path: Tauri bundled resources copied from `resources/chordpro`
- Windows runtime note: the full ChordPro distribution must be bundled, not only `chordpro.exe`, because the executable depends on Perl/runtime support files shipped with the installation

### ChordPro style configuration

- a global `style.json` is now used for all CLI executions
- this keeps rendering consistent across preview, single PDF export and songbook PDF export
- the config is resolved from Tauri bundled resources at runtime, with the repository `resources/chordpro-studio/style.json` path used during development
- the current provisional project style enables keyboard chord diagrams at the bottom of the page and uses project-specific PDF metadata instead of the original preset labels
- future user preferences should make chord diagrams configurable per user, including visibility, instrument and placement
- the current project style now renders chorus labels through `pdf.labels.comment`, so labels such as `Estribillo` appear above the section while the chorus bar remains active in the content area
- PDF headers now use centered title plus artist lines with shared footer layout on first and subsequent pages, and the style keeps extra top spacing reserved on all pages to avoid header overlap in multi-page songs
- chord and section comment fonts were strengthened for readability (`sans bold 11`) while boxed or shaded section labels remain disabled

- date: 2026-03-21
- context: replacing the locally copied ChordPro runtime with an official redistributable Windows release before making the repository public
- assumption made: `resources/chordpro` should contain only the runtime files recreated from the official `ChordPro 6.090.1` Windows installer artifact (`ChordPro-Installer-6-90-1-2-msw-x64.exe`), while the project-specific style config must move out to `resources/chordpro-studio/style.json` so the third-party bundle remains clean
- reason for the assumption: this keeps the third-party runtime provenance explicit, removes local-install leftovers, and preserves the app's existing preview/export behavior with only a minimal path adjustment
- whether it requires later validation: yes

## File Encoding Rule

All text files in the project must use UTF-8 encoding without BOM.

This includes:

- Markdown documentation
- prompt files
- TypeScript files
- configuration files

Special characters such as accented vowels must be preserved correctly.

If encoding issues appear (for example broken accented characters), the file must be rewritten using UTF-8 encoding.

## Commit Policy

Before creating any commit, Codex must review the entire working tree.

If manual changes exist in the repository (for example documentation edits made by the user), Codex should include them in the commit when they belong to the same logical change.

Codex should avoid leaving unrelated uncommitted files after a task unless explicitly instructed.

## Documentation Changes

When documentation files are manually edited by the user, Codex should treat them as authoritative changes and include them in the next relevant commit unless instructed otherwise.

- date: 2026-03-14
- context: introducing a user-facing mode alongside the existing Playground
- assumption made: the app should keep a single shared UI workspace for raw input, ChordPro text, preview and export state so switching between `User` and `Playground` mode does not reset data, while the new User View exposes only a simplified `Fast` / `Quality` Gemini selector mapped to `gemini-flash-lite-latest` and `gemini-flash-latest`
- reason for the assumption: the task requires reusing the exact same pipeline, preview and export mechanisms without duplicating architecture, and preserving state across view switches is simplest when both views operate on the same workspace
- whether it requires later validation: yes

- date: 2026-03-15
- context: introducing provisional application branding assets for Tauri and the Vue UI
- assumption made: the user-provided transparent master icon should be kept in `app/src/ui/assets/master-icon.png` as the editable source, derived PNG logo sizes should live beside it for UI use, and Tauri desktop icons should be generated into `src-tauri/icons/` (`icon.ico`, `icon.png`, `32x32.png`, `128x128.png`, `128x128@2x.png`) without changing application behavior beyond branding
- reason for the assumption: the current task is a visual branding pass, the provided artwork is explicitly provisional, and keeping one editable source plus generated derivatives is the simplest way to allow later icon replacement without refactoring code paths
- whether it requires later validation: yes

- context: introducing folder-based songbook persistence and auto-opened last songbook state
- assumption made: the desktop app can use a broad frontend filesystem scope so it can reopen the last chosen songbook folder on startup from the Tauri `AppConfig` directory (`$APPCONFIG/config.json`, resolved from the app identifier) without requiring the user to pick the folder again each session
- reason for the assumption: the task explicitly requires auto-opening the last songbook and does not introduce persisted filesystem scopes or extra backend commands for that path access
- whether it requires later validation: yes

- date: 2026-03-15
- context: deferring post-MVP songbook ergonomics
- assumption made: manual songbook refresh and a raw `.cho` textarea are acceptable for this phase, while filesystem watching and a structured lyric/chord editor remain future improvements
- reason for the assumption: the current roadmap block targets minimal persistence only, and the existing parser/preview flow already works with raw ChordPro text without adding another editor model
- whether it requires later validation: yes

## Branding Notes

- the current app icon/logo is provisional and may be replaced later by final brand assets
- editable source asset: `app/src/ui/assets/master-icon.png`
- current UI headers import `app/src/ui/assets/logo-64.png`
- current Tauri development/package icon set lives in `src-tauri/icons/`

## UI Layout Notes

- the User View refactor is now implemented: the shell is viewport-constrained, the header is fixed within the view, preview height stays stable across states, and panel scrolling is internal only

- the current panel-height inconsistency comes from the layout model, where overall page height and panel content height are not constrained from a single application shell
- trying to fix this at component level is incorrect because textareas, PDF preview and list states should not control the layout height of the app
- the chosen direction is a fixed-height application layout constrained to the viewport, with a non-scrollable header, no global page scroll and internal scrolling only inside panel content areas
- this removes the need for runtime height synchronization logic between panels and makes empty, loading and populated states layout-neutral

## User View Notes

The application now has two UI modes:

- `User`: a minimal two-column interface for normal workflow (`raw input -> convert -> preview -> export`)
- `Playground`: the existing developer/debugging interface with intermediate pipeline stages

Both modes reuse the same front-end workspace state and the same underlying pipeline, preview and export adapters. That shared workspace is now a singleton returned by `useSongWorkspace()`, so changing views does not recreate the active document state.

User View model selector:

- `Fast` -> `gemini-flash-lite-latest`
- `Quality` -> `gemini-flash-latest`
- the selected conversion mode is loaded from AppConfig on startup and falls back to `Quality` only when `conversionMode` is missing

Playground model selector:

- the selected Gemini model is loaded from AppConfig on startup and falls back to `gemini-flash-latest` only when `playgroundModel` is missing
- if a runtime override is present through environment variables, that override still takes precedence and the persisted preference is not rewritten on load

The User View now keeps `Convert` as the default active panel, preserves the VSCode-style sidebar for `Convert` / `Songbook`, and uses a layout-controlled optional ChordPro editor instead of a collapsible panel. The editable `.cho` area still reuses the same `chordProText` state used for preview and export, and can regenerate the preview directly from the edited source without re-running the full pipeline.

## Songbook and Persistence Notes

Minimal persistence now follows this flow:

`.cho` file
-> filesystem adapter (`SongRepository`)
-> `ChordProParser`
-> shared `WorkspaceDocument`
-> preview refresh through the existing ChordPro CLI preview path

Songbook behavior:

- a songbook is a user-selected folder scanned for `.cho` files only
- song entries are sorted alphabetically by their derived `displayTitle`
- opening a song clears the raw conversion input, loads the ChordPro source directly, parses it into the Song domain model and refreshes the preview without calling the LLM pipeline
- the last selected songbook path is stored in the Tauri `AppConfig` directory as `config.json` and reloaded on startup without changing the default `Convert` panel on launch
- AppConfig now also stores `conversionMode`, `playgroundModel` and `geminiApiKey`
- frontend config is loaded once through `useAppConfig()`, kept in memory as the single source of truth, and persisted through Tauri backend commands
- missing `config.json` now resolves to a default config with `geminiApiKey: null`, and the backend creates the file on first read when needed
- clearing the active songbook removes `lastSongbookPath` from config without changing the currently open document

Workspace document behavior:

- the shared workspace now tracks a `WorkspaceDocument` with `filePath`, `fileName`, `chordProText`, parsed `song` and `dirty`
- `useSongWorkspace()` returns the same singleton instance everywhere; `User`, `Playground` and songbook interactions all mutate that single workspace instead of keeping view-local copies
- editing ChordPro source marks the document dirty
- the current `.cho` document in memory is the single source of truth for destructive replacement checks
- reconverting an already opened `.cho` preserves the active `filePath` and updates the parsed song metadata immediately so the editor header, save logic and song list refresh stay aligned
- unified unsaved-change protection now covers songbook navigation, rerunning `Convert`, and closing the application window
- unsaved detection is centralized in `hasUnsavedChanges`: saved document + `dirty`, or unsaved document + non-empty `chordProText`
- Tauri close interception for this flow depends on explicit main-window permissions for `window.close` / `window.destroy` in `src-tauri/capabilities/main.json`
- conservative filename normalization for existing files also depends on explicit `fs:allow-rename` permission in `src-tauri/capabilities/main.json`

Future improvements kept explicitly out of this phase:

- add a filesystem watcher to refresh the songbook automatically when `.cho` files are added, removed or renamed
- replace the raw `.cho` editor with a structured chord editor that supports lyric/chord dual-line editing

- date: 2026-03-21
- context: introducing user-managed Gemini API key storage through Tauri config commands and `useAppConfig()`
- assumption made: app configuration should be loaded once at startup, stored in a single frontend composable, and injected into the shared workspace so User mode can block generation before any provider call when `geminiApiKey` is missing
- reason for the assumption: this keeps config ownership centralized, avoids scattered filesystem reads, and matches the documented local-first desktop architecture
- whether it requires later validation: yes

- date: 2026-03-21
- context: cleaning up the developer Playground layout and hiding it in production builds
- assumption made: the Playground header should align visually with the User header, panel descriptions inside the 5 technical blocks should be removed as redundant UI noise, and the raw input block should be the dominant panel in desktop and two-column responsive layouts while preview keeps a standard panel width
- assumption made: the Playground should follow the same fixed-height shell rules as the User view while remaining a DEV-only internal tool, so production UX always starts and stays in `User` mode without exposing the extra toggle, while production User mode also hides the `Workspace` eyebrow that only helps differentiate views in development
- reason for the assumption: this preserves the debugging workflow during development but removes non-product UI from the release build without duplicating workspace state
- whether it requires later validation: yes


