# Development Notes

This document records development-time decisions, selected assumptions, and items that require later review.

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

## Assumptions & implicit decisions

Only record assumptions here when they materially affect behavior, UX, architecture, heuristics, or fallback logic.

* [assumption] frontend prompt loading resolves only bundled `app/prompts/*.prompt.md` assets in the desktop app, not runtime filesystem fallbacks
  impact: medium
  revisitable: yes
* [assumption] the conversion model is treated as a deterministic ChordPro transformer, and output is validated before parsing
  impact: high
  revisitable: yes
* [assumption] preview and PDF export continue to rely on the bundled ChordPro CLI plus native WebView PDF rendering via Blob URLs instead of alternative viewer pipelines
  impact: high
  revisitable: yes
* [assumption] metadata normalization applies only to fresh LLM conversion output, not to existing `.cho` files or later manual edits
  impact: medium
  revisitable: no
* [assumption] preview caching stays backend-local, keyed by `SHA-256(chordProText + effective render style)`, and falls back silently to normal generation on cache failures
  impact: medium
  revisitable: no
* [assumption] startup restoration reopens the last songbook and song only when persisted paths still exist, otherwise it fails silently to an empty Songbook state
  impact: low
  revisitable: no
* [assumption] save and export renaming stays conservative and only happens when a normalized target path is safe and conflict-free
  impact: medium
  revisitable: no
* [assumption] smart tab splitting only preprocesses explicit `{start_of_tab}` blocks, uses estimation-based width limits (`70` / `35`), and falls back to `{columns: 1}` on malformed tab input
  impact: medium
  revisitable: yes
* [assumption] PDF fit is decided from the actual preview iframe size with an A4-aware heuristic rather than the full window size
  impact: medium
  revisitable: yes
* [assumption] performance-mode fit refresh forces the hidden iframe through `about:blank` before loading the next fitted PDF URL so the native viewer reliably reloads rapid fit changes
  impact: medium
  revisitable: yes
* [assumption] save and export feedback uses a single global toast with last-message-wins behavior instead of a full notification system
  impact: low
  revisitable: yes
* [assumption] `releases/` is the canonical human-facing artifact location, grouped under `releases/vX.Y.Z/`, while `src-tauri/target/` remains transient build output
  impact: low
  revisitable: no
* [assumption] local rebuilds must keep version metadata synchronized across Tauri, workspace package files and Cargo metadata, and Windows upgrade checks should compare the same installer family, preferably MSI
  impact: high
  revisitable: no

## Local rebuild notes

- local rebuild `v1.4.0` was produced after syncing version metadata across `package.json`, `app/package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the Cargo-generated lockfile update
- final human-facing artifacts for the rebuild were collected under `releases/v1.4.0/`, keeping `src-tauri/target/` as transient build output only
- local release artifacts keep the `-local` suffix in their human-facing names while the runtime app version stays `1.4.0`

## Post v1.4.0 direction

- the project is now in a real usage validation phase
- current priority is resolving real user friction, improving UX clarity and flow, and avoiding speculative features

### Product direction clarification

- current focus is the `User` view, Songbook workflow, and the shared Preview + Export flow
- deprioritized areas for now are Playground expansion, internal tooling growth, and complex optimizations without a proven real need

### Songbook PDF exploration note

- `style.json` capabilities should be explored and documented before implementing advanced Songbook PDF features
- avoid designing PDF features that the ChordPro CLI cannot actually support

## Post v1.4.x friction findings

- save behavior couples metadata changes with filename suggestion, which can create unintended file duplication
- the `.cho` editor scroll reset issue on song change is now resolved in Songbook by resetting the editor textarea only when the active song path changes, not during edits within the same song
- Songbook management is still intentionally minimal:
  - no delete flow yet
  - no new empty song creation yet
  - no explicit duplication / `Save As` flow yet
  - these remain planned future improvements
- Performance mode still has room for UX refinement, but those changes should be handled through a structured UX review rather than ad-hoc incremental tweaks

## Post global usage review (v1.4.x stabilization)

- a keyboard vs mouse selection conflict is still present in song-list interaction when autoscroll and hover compete
- the current title fallback can still surface chord-only lines instead of a meaningful label when metadata is missing
- preview auto-refresh timing can still interrupt editing flow and likely needs a slightly longer debounce
- additional improvements were identified for:
  - deterministic `{define}` inclusion during conversion
  - optional tab-block render filtering without changing the original `.cho`
  - PDF navigation usability around returning to the index
  - clearer but still non-intrusive distinction between `active` and `selected` song states

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
-> if the active document already exists on disk: `Save` now overwrites that file by default, and any metadata-driven filename change must go through an explicit confirmation plus native `Save as new file` flow instead of a silent rename

Save behavior notes:

- existing `.cho` files now preserve file identity on normal `Save`
- when metadata implies a different filename, the app asks whether to keep the current file name or open `Save as new file`
- `Save as new file` never deletes or silently replaces the original file; it either writes a genuinely new file or, on Windows case-only rename scenarios, overwrites the current file and then applies a controlled temporary rename sequence to preserve the requested casing

Songbook PDF export now follows this flow:

frontend songbook action
-> read `.cho` files directly from the active songbook folder
-> sort them alphabetically by filename
-> native save dialog
-> Tauri `export_songbook_pdf`
-> execute bundled ChordPro CLI with multiple input files and `--output`
-> generate a single PDF for the full songbook

Export feedback behavior:

- save and export feedback now appears through a small global toast mounted once at app root instead of inline messages under action buttons
- preview export now exposes explicit Export PDF and Export CHO actions for clarity, while the save dialog still lets the user override the final file type before saving
- only one toast is shown at a time, so newer feedback replaces older feedback instead of queueing
- success and info messages auto-dismiss, while errors remain visible until manually dismissed
- success messages use the saved filename when available
- shared workspace cleanup is split between `clearGeneratedState()` (results only) and `clearAllState()` (raw input plus generated state) so `User` and `Playground` can choose the correct behavior without duplicating reset logic
- Preview `.cho` export now follows the same conservative safe-rename rule used by direct editor save when it targets the current document

Preview failure behavior:

- if preview generation fails, the previous valid preview remains visible
- the frontend shows the backend error message returned by the failed preview command
- while a new preview is being generated, the shared workspace exposes a dedicated preview-loading state so both `User` and `Playground` show either a centered loading placeholder (when no preview exists yet) or a soft overlay above the current PDF without clearing the previous valid preview
- the backend now reuses a persistent preview cache under `$APPCONFIG/cache/previews/`, keyed by `SHA-256(chordProText + effective render style)`, so unchanged previews can be returned without invoking the CLI again without mixing different diagram-visibility or instrument variants
- the manual `Refresh` action in Convert, Songbook and Playground now reuses the same preview pipeline with an explicit `bypass_cache` flag, so users can force a fresh CLI render without introducing a parallel preview path
- preview errors are cleared at the start of a new preview generation so stale failure messages do not survive a later successful preview
- User View `Generate` now keeps the existing `.cho` editor content visible behind a non-editable loading overlay until the conversion result is ready, using the same shared loading-card visual treatment as preview instead of clearing the editor upfront
- User View `.cho` editor now refreshes preview with a debounced non-blocking path and keeps the current iframe/PDF visible while a new blob URL is loading
- the User View preview now uses a local dual-iframe buffer with a short delayed swap so the next PDF can load before becoming visible, reducing flicker without changing the underlying native viewer approach
- both `User` and Songbook performance mode now delay the visible `Generating preview...` overlay slightly for normal cached preview loads, but manual `Refresh` shows loading immediately because it explicitly requests regeneration
- changing Convert/Songbook context while `Generate` is still running now reuses the existing abort/stale-request protection so outdated conversion results are not applied to a newer workspace context
- even with the buffered swap, the native PDF viewer can still introduce small temporary editor stalls while a refreshed document is being loaded into the WebView
- the current native PDF viewer approach still performs a full document reload when the iframe `src` changes; reducing that further would require a custom viewer outside the current architecture
- Songbook performance mode in `User` now switches the app shell into an immersive low-padding layout, keeps navigation controls local to the view, and shares the same iframe-size-based PDF fit composable as Convert and Songbook; the final fit decision is A4-aware, performance mode refreshes fit through a local hidden-frame swap that forces a real iframe navigation via `about:blank` before loading the next fitted PDF URL because the native Edge/WebView PDF viewer did not reliably reapply rapid hash-only changes, and exiting back to Songbook now preserves the active preview blob URL long enough to re-stage the normal dual-frame fade without triggering stale-file errors
- keyboard navigation in performance mode intentionally remains best-effort when focus stays in the app; once focus moves inside the native PDF viewer iframe, its own input handling takes precedence and the app does not try to steal focus back
- User View empty states were refined without changing panel layout: Songbook now uses a clearer no-folder call to action, loaded songbooks show a low-weight selection hint, and the Preview placeholder uses softer two-line guidance that adapts when a songbook is available
- Songbook view now keeps the active song visible when entering the panel or returning from Performance mode, reuses the existing selection auto-scroll during keyboard navigation, and extends ArrowUp / ArrowDown / Enter handling across the view only when focus is outside interactive controls such as buttons, inputs, textareas, contenteditable areas and the PDF viewer
- Songbook performance mode reuses its existing selection auto-scroll not only during list navigation, but also on entry and when the song sidebar is reopened, so the currently active song stays visible without introducing a separate scroll path
- the post-v1.4.0 performance-mode friction pass replaces the old modal-style sidebar/backdrop controls with two floating surfaces inside the preview area: a song panel with its own visual depth and a compact action dock anchored inside a scrollbar-safe preview inset, so the PDF remains the dominant surface while list and controls no longer collide with preview borders, native toolbar chrome or the vertical scrollbar
- performance-mode interaction now separates the currently opened song from the currently selected list item: the dock and its keyboard shortcuts always navigate relative to the song currently shown in preview, while the list keeps an independent `selected` state for keyboard/mouse browsing, with `active` vs `selected` visual distinction and hover allowed to update selection without opening the song
- Songbook and performance mode now share the same presentational `SongList` component and ordered song list, but keyboard handling, focus management, selection state, auto-scroll and song-opening behavior remain local to each parent view rather than moving into shared UI state

Bundled CLI expectation:

- repository/development path: `resources/chordpro/chordpro(.exe)`
- packaged app path: Tauri bundled resources copied from `resources/chordpro`
- Windows runtime note: the full ChordPro distribution must be bundled, not only `chordpro.exe`, because the executable depends on Perl/runtime support files shipped with the installation

### ChordPro style configuration

- a global `style.json` is now used for all CLI executions
- this keeps rendering consistent across preview, single PDF export and songbook PDF export
- the config is resolved from Tauri bundled resources at runtime, with the repository `resources/chordpro-studio/style.json` path used during development
- the current provisional project style still defines the shared baseline layout and PDF metadata, while runtime render preferences can now switch chord-diagram visibility and instrument (`piano` / `guitar`) without introducing a parallel render path
- the current project style now renders chorus labels through `pdf.labels.comment`, so labels such as `Estribillo` appear above the section while the chorus bar remains active in the content area
- PDF headers now use centered title plus artist lines with shared footer layout on first and subsequent pages, and the style keeps extra top spacing reserved on all pages to avoid header overlap in multi-page songs
- chord and section comment fonts were strengthened for readability (`sans bold 11`) while boxed or shaded section labels remain disabled
- chord-diagram preferences now persist `showChordDiagrams` and `instrument` in AppConfig, with defaults of `true` and `piano`, preserving compatibility for older configs
- those preferences are exposed from a lightweight Preferences popover anchored to the bottom of the User View sidebar instead of a separate full-size settings panel
- preview, single-song PDF export and songbook PDF export now share the same effective render-style options for chord-diagram visibility and instrument, and preview cache validity now includes those style dimensions so different variants do not mix
- the runtime instrument preference now supports `piano`, `guitar` and `ukulele`; `ukulele` must load the bundled ChordPro `ukulele.json` preset in addition to `instrument.type=ukulele`, because changing the instrument type alone leaves the default guitar tuning/chord set active
- ukulele rendering now injects a small transparent enharmonic-alias layer into the temporary render text before invoking the CLI, so sharp-based chord names such as `F#`, `G#m`, `D#m`, `C#m` and `F#m` can reuse the preset's flat-based ukulele diagrams without changing the visible chord names in the original `.cho`
- current limitation: existing custom chord definitions written as 6-string fret grids can still work for guitar and keyboard rendering, but are not automatically adapted for the 4-string ukulele preset; future work may revisit this both in render-time preprocessing and in the LLM-to-`.cho` conversion rules when ukulele output becomes a stronger target workflow
- when chord diagrams are disabled at runtime, the CLI integration must use the global `diagrams.show=none` switch and must not pass `kbdiagrams.show=none`; ChordPro routes diagram generation through `diagrams.show`, while `pdf.kbdiagrams.show` controls keyboard-diagram placement and does not accept `none`
- if future style/runtime changes touch diagram visibility or placement, re-check the official ChordPro configuration docs for `diagrams.show`, `pdf.diagrams.show` and `pdf.kbdiagrams.show` semantics before extending the CLI `--define` arguments
- some lines with multiple long chords can still overflow horizontally in PDF output even when the lyric text itself looks normal, because ChordPro reserves fixed chord spacing and aligns lyrics underneath without exposing smart reflow or dynamic compression controls for these cases
- this is currently treated as a ChordPro engine limitation rather than an application bug; the app should not introduce heuristic rewrites, global font-size changes or layout patches for it, and the recommended workaround is to split the affected line manually when needed

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

## Branding Notes

- the current app icon/logo is provisional and may be replaced later by final brand assets
- editable source asset: `app/src/ui/assets/master-icon.png`
- current UI headers import `app/src/ui/assets/logo-64.png`
- current Tauri development/package icon set lives in `src-tauri/icons/`
- the window title now appends the runtime app version as `ChordPro Studio - vX.Y.Z`, resolved from Tauri package metadata at startup instead of hardcoded frontend strings, so the visible title stays synchronized with `tauri.conf.json`

## Startup loading notes

- the app now renders a lightweight bootstrap loader directly inside `app/index.html`, so `#app` is no longer empty before Vue mounts
- the main Tauri window starts hidden and is shown only after the shared boot loader has rendered, avoiding the initial white/empty window that appeared before the WebView painted its first frame
- the existing app-level startup loader in `App.vue` remains the same logical loading state, but now reuses the same visual treatment as the bootstrap loader and stays as an overlay until config loading, workspace initialization and the first settled layout frames complete
- startup initialization now reports staged boot status text and falls back to a visible failure state instead of leaving the loader blocked forever when config or workspace initialization throws

## Editor typography notes

- all main text editors now use the same shared monospace stack in Convert, Songbook and Playground to preserve chord alignment while keeping their previous font size, line-height and layout rules intact
- the monospace stack is centralized through a shared CSS variable and then applied explicitly only to editor textareas, so non-editor UI text keeps the normal application font
## UI Layout Notes

- the User View refactor is now implemented: the shell is viewport-constrained, the header is fixed within the view, preview height stays stable across states, and panel scrolling is internal only

- the current panel-height inconsistency comes from the layout model, where overall page height and panel content height are not constrained from a single application shell
- trying to fix this at component level is incorrect because textareas, PDF preview and list states should not control the layout height of the app
- the chosen direction is a fixed-height application layout constrained to the viewport, with a non-scrollable header, no global page scroll and internal scrolling only inside panel content areas
- this removes the need for runtime height synchronization logic between panels and makes empty, loading and populated states layout-neutral

## Unsaved content safeguard

- destructive clear actions in Convert (`New Sheet`) and Playground (`Clear all`) now reuse a shared app-level Save / Discard / Cancel confirmation modal instead of clearing immediately
- the safeguard uses a lightweight detection rule: prompt only when content is present and not already safely persisted, with raw input treated as unsaved content even before ChordPro is saved
- when metadata is already available through the existing workspace parsing/metadata path, the modal shows `Title - Artist` (or the single available value) as a secondary line
- `Save` reuses the existing save flow and only clears content after a successful save; failed or cancelled saves leave the content intact

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

- the sidebar now also includes a light Preferences entry at the bottom and subtle button borders so the navigation affordances remain visible even when only one button is active nearby
- the main sidebar buttons now stretch to the full available width of the rail, and the rail itself is slightly wider in desktop layout, resolving the previous `Songbook` label/icon alignment bug without changing the overall panel structure
- sidebar navigation buttons now use square hit areas derived from the rail sizing itself, with centered icon/label layout and larger lower-stroke icons so the rail reads more clearly without adding a separate button system or changing navigation behavior

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
- the main Songbook list now presents each entry as a compact two-line `title` / `artist` block with a folder-name header badge, keeping the underlying songbook data flow unchanged while improving scanability
- the main Songbook view now applies local in-memory sorting controls for `artist` / `title` with asc/desc toggling; ordering stays deterministic through primary field, secondary field and filename fallback without mutating the underlying songbook data
- the last selected songbook path is stored in the Tauri `AppConfig` directory as `config.json` and reloaded on startup
- when that persisted songbook is available, startup now also restores the last explicitly opened song if the file still exists; otherwise Songbook opens with no active selection and no startup error
- AppConfig now also stores `lastOpenedSongPath`, `conversionMode`, `playgroundModel`, `geminiApiKey`, `showChordDiagrams` and `instrument`
- frontend config is loaded once through `useAppConfig()`, kept in memory as the single source of truth, and persisted through Tauri backend commands
- missing `config.json` now resolves to a default config with `geminiApiKey: null`, and the backend creates the file on first read when needed
- clearing the active songbook removes `lastSongbookPath` from config without changing the currently open document

Workspace document behavior:

- the shared workspace now tracks a `WorkspaceDocument` with `filePath`, `fileName`, `chordProText`, parsed `song` and `dirty`
- `useSongWorkspace()` returns the same singleton instance everywhere; `User`, `Playground` and songbook interactions all mutate that single workspace instead of keeping view-local copies
- editing ChordPro source marks the document dirty
- the current `.cho` document in memory is the single source of truth for destructive replacement checks
- reconverting an already opened `.cho` preserves the active `filePath` and updates the parsed song metadata immediately so the editor header, save logic and song list refresh stay aligned
- running `Convert` from raw input now creates a detached unsaved document with no associated `filePath`, so saving a newly generated song opens `Save As` instead of overwriting the previously opened songbook file
- Songbook list interaction in the main `User` view now mirrors the performance-mode list model: `active` stays tied to the song currently opened in preview, `selected` tracks keyboard or mouse browsing, hover can update selection without opening the song, and the list container keeps keyboard ownership so `ArrowUp` / `ArrowDown` / `Enter` / `Space` behave consistently even after focus leaves the list
- Songbook list sorting preserves both the active previewed song and the locally selected list item by `filePath` rather than by index, so reordering does not silently change the song or break the existing keyboard navigation model
- unified unsaved-change protection now covers songbook navigation, rerunning `Convert`, and closing the application window
- unsaved detection is centralized in `hasUnsavedChanges`: saved document + `dirty`, or unsaved document + non-empty `chordProText`
- Tauri close interception for this flow depends on explicit main-window permissions for `window.close` / `window.destroy` in `src-tauri/capabilities/main.json`
- conservative filename normalization for existing files also depends on explicit `fs:allow-rename` permission in `src-tauri/capabilities/main.json`

Future improvements kept explicitly out of this phase:

- add a filesystem watcher to refresh the songbook automatically when `.cho` files are added, removed or renamed
- replace the raw `.cho` editor with a structured chord editor that supports lyric/chord dual-line editing
