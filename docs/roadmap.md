# Roadmap

## Phase 1 - MVP

Goals:

- basic conversion pipeline
- preview
- PDF export
- local preferences

## Completed work

### Block 1 - Completed foundation

1. Replace the temporary export prompt with a proper Tauri file save dialog.
2. Introduce a clean user-facing view separate from the developer Playground.
3. Add navigation between:
   - User interface
   - Playground (development/debug view).
4. Support exporting the current song as `.cho`.
5. Add a visible loading state while preview is being generated.
6. Improve preview and export feedback messages.

### Block 2 - Completed persistence foundation

7. Resolve the residual User View layout scroll and basic sizing polish.
8. Persist the last opened songbook path in AppConfig.
9. Allow clearing the active songbook without closing the current document.

### Block 3 - Completed minimal persistence

10. Open existing `.cho` files.
11. Provide a simple folder-based list of songs.
12. Reconstruct the internal Song model by parsing `.cho` files on open.

### Block 4 - Completed songbook export

13. Allow exporting multiple songs into a single PDF songbook using the ChordPro CLI.

### Block 5 - Completed User View layout refactor

14. Refactor the app into a fixed-height layout with a non-scrollable header, no global page scroll and panel-local scrolling.
15. Revalidate `BUG-10` after the layout refactor.
16. Resolve the remaining User View panel height sync issue tracked as `BUG-10`.
17. Run a full manual review of the application after the layout refactor.
18. Apply a UI consistency pass to the User View.

### Block 6 - Completed Playground cleanup

19. Clean up the Playground UI (layout, redundant labels, language consistency, DEV-only gating and responsive panel distribution).

### Block 7 - Completed release preparation

20. Compile the v1 release build.

---

## Phase: Usable v1

Focus:

- the technical MVP pipeline is now functional
- the next step is turning the current pipeline playground into a minimal usable application for creating chord sheets

Current status:

### v1 baseline

- native Tauri export dialog implemented
- export supports both `.pdf` and `.cho`
- user-facing view implemented
- mode switch between `User` and `Playground` implemented
- preview now uses the real ChordPro PDF renderer
- preview loading state implemented in both `User` and `Playground`
- preview and export feedback messages implemented in the UI
- direct `.cho` preview for debugging is available
- residual User View scroll bug resolved
- folder-based songbook implemented
- existing `.cho` files can be opened and parsed without running the LLM pipeline
- workspace document tracks the current `.cho` file path and unsaved changes
- last opened songbook path is persisted in Tauri AppConfig and restored on startup
- User View conversion mode and Playground model selection are persisted in AppConfig and restored on startup
- active songbook can be cleared without affecting the current document
- provisional application icon and header logo integrated for Tauri and the `User` / `Playground` views
- unified save/discard/cancel protection now covers convert replacement, songbook navigation and app close
- `User` and `Playground` now share a single workspace singleton, so switching views preserves the active document and generated state
- songbook PDF export is implemented through the bundled ChordPro CLI using the same global style config as preview and single-song export, with provisional bottom keyboard diagrams and project-specific PDF metadata
- fixed-height User View layout refactor implemented with panel-local scrolling and stable preview sizing
- `BUG-10` revalidated and resolved after the User View layout refactor
- manual review and UI consistency pass completed for the User View
- Playground cleanup completed with a fixed-height layout, DEV-only visibility, normalized header structure and improved responsive panel distribution
- frontend `PromptLoader` now loads prompts only from bundled assets, and the Vite `node:fs/promises` warning is resolved
- LLM-generated `title` and `artist` metadata is now normalized locally before parsing, while existing `.cho` file loading remains unchanged
- chord-only separator lines such as `[G] - [Am] - [Em]` are now cleaned safely before parsing, while mixed content remains unchanged
- BUG-15 resolved: reconversion now keeps active song metadata synchronized in the editor and song list, and saving applies conservative safe filename normalization without creating duplicates

### v1.1

- v1.1 post-release improvements completed
- User View `.cho` editor now refreshes preview automatically with debounced regeneration, request ordering protection, a lightweight non-blocking spinner and a double-buffered iframe swap to reduce visible flicker
- conversion requests can now be aborted safely from both `User` and `Playground`, with real provider cancellation support and stale-response protection in the shared workspace

### v1.2

- v1.2 performance mode for Songbook is now implemented inside `User`, with immersive app-shell padding, overlay song list, maximized PDF preview, keyboard and button navigation, and adaptive PDF fit behavior based on preview aspect ratio
- v1.2 PDF style refinements completed through `style.json`, including top-positioned chorus labels, cleaner section comments, stronger chord contrast, unified header/footer layout and improved page spacing

### v1.3

- v1.3 startup workflow refinement now restores the last opened song when the persisted songbook is available, opens Songbook automatically on startup in that case, and falls back to Convert when no songbook is configured
- v1.3 songbook navigation now keeps keyboard selection visible with smooth auto-scroll, and performance mode can be entered fully from the keyboard through `F11`, `Enter`, `Esc` and list navigation keys
- v1.3 preview generation now reuses a persistent PDF cache keyed by `chordProText`, so unchanged previews survive app restarts and cache hits avoid unnecessary ChordPro CLI execution
- v1.3 light UX refinement completed with clearer Songbook and Preview empty states, a stronger folder-entry call to action, and lower-weight preview guidance without changing the panel layout

### v1.4

- v1.4 smart tab splitting is now applied to explicit `{start_of_tab}` blocks in preview, single-song PDF export and songbook PDF export, using balanced heuristic chunking for one- and two-column layouts plus a silent single-column fallback for malformed tab blocks
- v1.4 PDF fit behavior is now unified across Convert, Songbook and Performance views through a shared iframe-size-based fit composable, with A4-aware fit decisions, a smooth performance-mode refresh path that forces reliable hidden-frame navigation without visible flicker, and validated preview/export consistency for single-song and songbook flows
- v1.4 save and export feedback now uses a small reusable toast mounted at app level, replacing inline success/error messages under action buttons without introducing a full notification system
- v1.4 preview export now uses explicit Export PDF and Export CHO actions, while the save dialog still allows overriding the final file type before saving
- v1.4 destructive clear actions now protect unsaved Convert and Playground content with a shared app-level Save / Discard / Cancel confirmation modal, reusing current metadata when available and skipping the prompt when content is already safely persisted
- v1.4 Songbook now keeps the active song visible when entering the panel or returning from Performance mode, preserves auto-scroll during keyboard navigation, and allows ArrowUp / ArrowDown / Enter navigation across the view while ignoring interactive controls; Performance mode now reuses the same song-list autoscroll on entry and when reopening the sidebar
- v1.4 manual Refresh now forces preview regeneration through the existing preview pipeline with cache bypass, keeps normal preview loads cached, shows loading immediately for the explicit refresh action, and preserves smooth preview transitions when entering or exiting Songbook performance mode
- v1.4 window title now shows the runtime app version as `ChordPro Studio - vX.Y.Z`, sourced from Tauri package metadata instead of hardcoded frontend values
- v1.4 startup loading now avoids the initial white window by combining a lightweight bootstrap loader in `index.html`, a hidden main Tauri window shown only after the boot UI is rendered, and a short fade that keeps the real layout covered until the first render settles
- v1.4 all main text editors now use a shared monospace stack in Convert, Songbook and Playground, improving chord alignment without changing sizing or layout
- v1.4 first minimal user preference now exposes Show chord diagrams through a lightweight sidebar popover, persists in AppConfig, updates preview and PDF export in real time, and extends preview cache validity so diagrams ON/OFF never reuse incompatible cached PDFs
- v1.4 chord-diagram instrument preference is now available through the same lightweight Preferences popover with a segmented control (`Piano` / `Guitar`), persists in AppConfig with backward-compatible defaults, updates preview and PDF export through the shared render-style path, and extends preview cache validity so instrument variants never mix
- v1.4 Convert now keeps previous `.cho` content visible behind a matching loading overlay during `Generate`, disables editor input until the new conversion result arrives, and reuses the existing abort/stale-context protection so outdated results are not applied after context changes

### v1.4.x

- v1.4 rendering quality and UX improvements are now considered closed; the remaining column/page-break edge cases stay within current ChordPro engine limits and are not planned for this version
- horizontal overflow in dense long-chord lines is now treated as a ChordPro engine limitation rather than a pending app-side fix; the documented workaround is to split the affected line manually when needed
- v1.x sidebar navigation now lets the main rail buttons use the full available width and slightly widens the desktop rail, resolving the residual `Songbook` button alignment bug without introducing per-button layout exceptions
- v1.4.x Songbook performance mode now uses a floating song panel and compact dock inside the preview safe area, avoiding preview/list border collisions and scrollbar-native-toolbar overlap while preserving a larger PDF surface plus direct keyboard and mouse navigation with separate active and selected song states
- v1.4.x sidebar navigation buttons now use square hit areas with centered content, rail-derived sizing and larger lighter-weight icons, improving scanability and preserving the existing active/hover behavior without changing app structure
- v1.4.x Songbook list now uses a compact two-line title/artist layout with a folder-name header badge, separate active and selected states, hover-driven selection, and aligned `ArrowUp` / `ArrowDown` / `Enter` / `Space` behavior between list focus and global Songbook navigation
- v1.4.x Songbook list sorting now provides compact header controls for `Title` / `Artist` with asc/desc toggling, deterministic in-memory ordering, and path-based preservation of active and selected songs across reordering
- v1.4.x Songbook and Performance mode now share a single reusable `SongList` UI component with the same two-line item layout, visual states and ordered song list, while keeping focus, keyboard navigation, scroll behavior and song-opening logic local to each parent view
- v1.4.x song-list selection now tracks keyboard versus mouse input per view, so keyboard navigation remains authoritative during autoscroll until real mouse movement, wheel input or click explicitly returns control to hover selection
- v1.4.x chord-diagram preferences now support `Ukulele` end-to-end through preview, single-song PDF export and songbook export, using the real ChordPro ukulele preset plus transparent enharmonic aliases so sharp-based chords such as `F#`, `G#m`, `D#m`, `C#m` and `F#m` render with ukulele diagrams while keeping their original chord names visible
- v1.4.x ukulele custom chord definitions remain limited to ukulele-compatible 4-string shapes; existing 6-string custom definitions can still work in guitar and keyboard contexts, but are not yet adapted automatically for ukulele
- v1.4.x saving an existing `.cho` file now preserves file identity by default, prompts explicitly when metadata suggests a different filename, and routes intentional renames through `Save as new file`, including controlled case-only renames on Windows when the user confirms the new casing
- v1.4.x Songbook now resets the `.cho` editor scroll position to the top when the active song changes, while preserving normal scroll behavior during editing within the same song
- v1.4.x missing song titles are now derived consistently from content across UI, preview, single-song PDF export and songbook export, skipping directives, tab blocks and chord-only lines, reusing the first valid lyric line when available, and falling back safely to artist, filename or `Untitled`; the active Songbook item now also updates and autoscrolls in real time while edits change its derived title or sort position
- v1.4.x Songbook auto-preview now waits for a longer editor pause before refreshing, using a fixed `2000ms` debounce that keeps preview updates automatic while reducing disruptive refreshes during normal `.cho` editing
- v1.4.x preview consistency is now corrected across Convert, Songbook, Performance and Playground: empty or metadata-only `.cho` states no longer surface stale or misleading PDF previews, instead falling back to a neutral contextual placeholder until renderable song content exists
- v1.4.x unsaved-content protection is now unified across Songbook and Performance song changes, while Convert `New Sheet` and app close protect non-empty Original text through a separate app-modal confirmation without merging it into the `.cho` dirty state

### v1.5

- v1.5 preview generation now runs the ChordPro CLI off the Tauri main thread while preserving the existing cache and renderer path, eliminates visible UI freezes during editing, and keeps latest-wins preview consistency through backend stale-request discarding plus frontend request ordering
- v1.5 Songbook auto-preview debounce is now reduced to `500ms` after manual validation, keeping preview updates near-instant in normal editing without reintroducing blocking
- v1.5 local smoke validation is now available through `npm run smoke`, validates parser and cleaning without LLM usage, reuses the real preview/export backend path, repeats preview successfully for cache stability, and leaves generated artifacts under `.smoke/` for inspection
- v1.5 Playground can now run the shared pipeline from `raw`, `cleaned`, or editable `ChordPro`, with manual intermediate editing plus lightweight `input` / `fresh` / `stale` block states for debugging downstream regeneration
- v1.5 Playground now includes lightweight panel visibility toggles integrated into the developer header, keeps hidden panels alive for focused debugging, and uses a more responsive one-row-or-one-column layout without changing pipeline behavior
- v1.5 abort UX now shows a single global `Processing cancelled` info toast for real pipeline cancellations, covering manual aborts in `User` and `Playground` plus automatic aborts caused by switching to Songbook
- v1.5 Gemini API key UX is now refined in `User` with a clearer set/manage modal, local format validation, show/hide plus copy/clear affordances, action toasts, and reliable external opening of the AI Studio key page in the system browser
- v1.5 Songbook UX now provides explicit total-count toast feedback for folder load and manual refresh, confirms `Clear` before removing the current folder, and fully resets Songbook-derived active document and preview state when the cleared song belonged to that folder

### v1.5.1

- v1.5.1 destructive Songbook actions now protect unsaved `.cho` changes consistently: `Clear` resolves the standard `Save / Discard / Cancel` flow before its own Songbook confirmation, and `Open folder` resolves the same `.cho` protection before explicitly confirming replacement of the currently loaded Songbook
- v1.5.1 conversion now blocks empty cleaned input before reaching the LLM, surfaces a dedicated insufficient-input message for real no-content cases, preserves metadata-only ChordPro as valid minimal output, and accepts lyric-only ChordPro results without requiring invented chords or mandatory metadata tags
- v1.5.1 Performance mode now keeps the active song visible when navigating with the dock or relative prev/next keyboard flow, reusing the existing viewport-alignment logic without collapsing the separate `active` and `selected` song states
- v1.5.1 Convert and Songbook now share the same ChordPro editor header pattern, and both surfaces expose the same `Unsaved changes` badge whenever the shared workspace still holds ChordPro content that is not safely persisted to disk

## Current roadmap

Pending, planned or possible work.

## v1.x backlog

### Desktop polish

- persist window size and position between desktop sessions
- restore the last active main view on startup when it does not conflict with restored songbook context

### Editor improvements

- add lightweight undo / redo UI controls for the main text editors
- add basic syntax highlighting for the `.cho` editor:
  - lightweight regex-based approach
  - no heavy editor refactor yet
  - avoid breaking current input behavior
- add an explicit discard / revert flow for file-backed editor changes instead of relying on indirect workarounds such as changing song or clearing context

### Product clarification

- clarify target user and core value proposition
- validate whether the current workflow is useful beyond the original personal use case
- refine product language, visual direction and first-use experience
- use findings to guide future prioritization across UX, export and feature expansion

### UX review pass

- run a structured UX/UI review by area:
  - Convert
  - Songbook
  - Preview
  - Performance mode
  - app shell (header, layout, global consistency)
- treat this as a dedicated pass rather than a sequence of scattered incremental tweaks
- include a focused Performance mode UX refinement review:
  - address keyboard focus loss after interacting with the PDF viewer
  - simplify the navigation model around direct song navigation instead of maintaining a long-term `selected` / `active` split
  - evaluate a dual layout strategy (`full preview` / `list + preview split`) for different reading and navigation contexts
  - evaluate close button placement
  - evaluate the song-list toggle affordance (e.g. handle / trigger)
  - evaluate prev / next navigation controls and overall control clarity
  - keep keyboard controls simple and allow optional explicit controls for mouse users
  - optimize preview refresh behavior during rapid navigation without tying navigation responsiveness to render completion
  - improve intuitiveness without breaking the current interaction model
- keep these as dedicated UX review topics rather than patch-fix candidates

### Songbook PDF improvements (incremental)

- explore and document `style.json` capabilities before implementing advanced PDF features
- findings should be documented before implementing advanced features
- improve index structure and metadata

### Conversion / LLM improvements

- improve the conversion prompt so custom chord definitions are included deterministically using `{define}`
- clarify and document that the default pipeline should behave as a transformer, not a generator
- current minimal-input generation behavior should not be treated as intended default behavior
- improve Gemini error feedback in User View with contextual and actionable provider-aware messaging while preserving technical detail in Playground
- classify provider failures more explicitly in the shared workspace path (for example invalid key, rate limit or network failure) without inventing unsupported details
- keep `Quality` / `Fast` as the primary user-facing model modes while evolving model selection underneath into a hierarchical mode -> model strategy
- allow automatic fallback only within the current mode and surface explicit user feedback when that fallback is used
- explore optional generative modes separately:
  - generate from title / artist
  - generate from example song
  - completion / continuation workflows
- define a section-header language policy for generated output:
  - respect source language
  - enforce a specific language
  - future preference-based configuration
- current generated section header language remains inconsistent across Spanish and English

### Rendering / CLI

- allow optional filtering of tab blocks (`{start_of_tab}` / `{end_of_tab}`) without modifying the original `.cho`

### Songbook management features

- delete song/file from the songbook with proper confirmation
- create a new empty song from scratch directly in the songbook (`New`) instead of relying on the current convert/save workaround
- add `Save As` to duplicate or create a copy with a new name

### Songbook / export improvements

- improve PDF navigation:
  - allow returning to the index from song pages
  - explore header/footer or clickable elements

### Song list improvements

- add filtering by artist and title
- add basic metadata-only search without searching full song content yet

### Preview cache management

- add a manual `pre-generate previews` action:
  - explicit user-triggered action only
  - sequential processing
  - visible progress feedback
  - cancelable
- do not introduce automatic background preview generation

### UI / UX improvements

- prevent accidental text selection in non-interactive UI elements (buttons, labels, icons) using scoped user-select rules
- UI visual refinement (non-layout):
  - improve colors, typography, spacing and visual hierarchy
  - introduce icons where appropriate
  - maintain current layout structure
- improve visual distinction between `active` and `selected` song in the list with a non-intrusive indicator
- add a UI-based rename capability as a complement to `Save As`
- extract the Gemini API key modal into a dedicated component for consistency with the existing modal components
- evaluate a lightweight shared modal shell for common modal behavior:
  - backdrop
  - transition
  - Escape handling
  - initial focus
  - shared layout/styling
- keep modal-specific content and actions local; avoid over-generalizing modal internals

### Preferences system (future)

- additional PDF/style options (fonts, spacing, layout tweaks)
- configurable export options

### Validation and diagnostics

- extend the current smoke validation with small regression coverage for deterministic core flows
- introduce small regression tests for parser, cleaning, preview cache and render preprocessing
- introduce structured logging system (file-based, timestamped) for debugging and diagnostics

### Technical improvements

- low priority: optimize preview cache invalidation so instrument changes do not force regeneration when chord diagrams are disabled
- not part of the current roadmap focus

### Distribution / installation

- clarify the current installation model as per-user under AppData
- evaluate whether per-machine installation should be supported in the future
- improve local installation workflow:
  - use installer-based setup (MSI / NSIS)
  - allow upgrade over existing installations
  - support uninstall / repair flows
- automatic updates (long-term):
  - evaluate auto-update mechanisms
  - consider infrastructure and UX implications

## v2 - Core feature expansion

- scraping
- chord analysis
- layout optimization
- song library
- ensure rendering robustness remains compatible with future layout optimization features
- evaluate richer editing capabilities for the .cho editor (e.g. structured chord manipulation, improved editing UX, potential migration beyond textarea)

### Songbook PDF enhancements

- preview full songbook before export to PDF
- cover page:
  - auto-generated cover (title, date, `Generated with ChordPro Studio`)
  - custom PDF cover support
- branding / watermark
- richer visual styling
- user-configurable ChordPro styles (UI-based)
  - chord diagram visibility, instrument and placement
- advanced export options:
  - song ordering
  - song selection (checkboxes)
  - table of contents configuration

### Advanced search

- content-based search across lyrics and full `.cho` content

### Potential preview system evolution

- evaluate a non-native PDF viewer such as PDF.js if advanced preview features require it
- evaluate an adaptive HTML performance viewer rendered from the internal `Song` model instead of the CLI/PDF path
- prioritize readability, continuous scrolling and dynamic controls such as zoom or font size over strict PDF fidelity in that alternative viewer
- keep PDF as the reference/export renderer and evaluate an optional HTML / PDF toggle for future performance-oriented reading flows

---

## Phase 3 - Advanced AI

Features:

- AI preference learning
- conversational adjustments
- automatic layout decisions
- optional text refinement using LLM:
  - spelling and punctuation review
  - non-destructive suggestions (not automatic rewriting)
  - user-controlled application of changes

---

## Phase 4 - Product Expansion

Features:

- mobile client
- songbook viewer
- performance mode
- setlists
- cloud sync
