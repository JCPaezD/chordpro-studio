# Roadmap

## Phase 1 - MVP

Goals:

- basic conversion pipeline
- preview
- PDF export
- local preferences

---

## Phase: Usable v1

Focus:

- the technical MVP pipeline is now functional
- the next step is turning the current pipeline playground into a minimal usable application for creating chord sheets

Current status:

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
- v1.1 post-release improvements completed
- User View `.cho` editor now refreshes preview automatically with debounced regeneration, request ordering protection, a lightweight non-blocking spinner and a double-buffered iframe swap to reduce visible flicker
- conversion requests can now be aborted safely from both `User` and `Playground`, with real provider cancellation support and stale-response protection in the shared workspace
- v1.2 performance mode for Songbook is now implemented inside `User`, with immersive app-shell padding, overlay song list, maximized PDF preview, keyboard and button navigation, and adaptive PDF fit behavior based on preview aspect ratio
- v1.2 PDF style refinements completed through `style.json`, including top-positioned chorus labels, cleaner section comments, stronger chord contrast, unified header/footer layout and improved page spacing
- v1.3 startup workflow refinement now restores the last opened song when the persisted songbook is available, opens Songbook automatically on startup in that case, and falls back to Convert when no songbook is configured
- v1.3 songbook navigation now keeps keyboard selection visible with smooth auto-scroll, and performance mode can be entered fully from the keyboard through `F11`, `Enter`, `Esc` and list navigation keys
- v1.3 preview generation now reuses a persistent PDF cache keyed by `chordProText`, so unchanged previews survive app restarts and cache hits avoid unnecessary ChordPro CLI execution
- v1.3 light UX refinement completed with clearer Songbook and Preview empty states, a stronger folder-entry call to action, and lower-weight preview guidance without changing the panel layout
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
- v1.4 rendering quality and UX improvements are now considered closed; the remaining column/page-break edge cases stay within current ChordPro engine limits and are not planned for this version
- horizontal overflow in dense long-chord lines is now treated as a ChordPro engine limitation rather than a pending app-side fix; the documented workaround is to split the affected line manually when needed
- v1.x sidebar navigation now lets the main rail buttons use the full available width and slightly widens the desktop rail, resolving the residual `Songbook` button alignment bug without introducing per-button layout exceptions
- v1.4.x Songbook performance mode now uses a floating song panel and compact dock inside the preview safe area, avoiding preview/list border collisions and scrollbar-native-toolbar overlap while preserving a larger PDF surface plus direct keyboard and mouse navigation with separate active and selected song states
- v1.4.x sidebar navigation buttons now use square hit areas with centered content, rail-derived sizing and larger lighter-weight icons, improving scanability and preserving the existing active/hover behavior without changing app structure
- v1.4.x Songbook list now uses a compact two-line title/artist layout with a folder-name header badge, separate active and selected states, hover-driven selection, and aligned `ArrowUp` / `ArrowDown` / `Enter` / `Space` behavior between list focus and global Songbook navigation
- v1.4.x Songbook list sorting now provides compact header controls for `Title` / `Artist` with asc/desc toggling, deterministic in-memory ordering, and path-based preservation of active and selected songs across reordering

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

## Current roadmap

## v1.4.x - Post-release friction fixes & UX improvements

### UI consistency

- unify Songbook list UI across Songbook and Performance mode:
  - extract a shared list component
  - reuse the new two-line hierarchy and item styling in both views
  - keep focus, selection and keyboard interaction local to each view

### Feature

- add `ukulele` as a selectable instrument when supported by the ChordPro CLI

## v1.x - Additional UX / dev improvements

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

### Songbook PDF improvements (incremental)

- explore and document `style.json` capabilities before implementing advanced PDF features
- findings should be documented before implementing advanced features
- improve index structure and metadata

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

### Editor improvements

- add basic syntax highlighting for the `.cho` editor:
  - lightweight regex-based approach
  - no heavy editor refactor yet
  - avoid breaking current input behavior

### UI / UX improvements

- prevent accidental text selection in non-interactive UI elements (buttons, labels, icons) using scoped user-select rules
- UI visual refinement (non-layout):
  - improve colors, typography, spacing and visual hierarchy
  - introduce icons where appropriate
  - maintain current layout structure

### Preferences system (future)

- additional PDF/style options (fonts, spacing, layout tweaks)
- configurable export options

### Playground and dev workflow

- add a side menu to the Playground to toggle panel visibility
- allow running the pipeline from intermediate steps in Playground:
  - trigger pipeline execution from any block
  - allow manual editing of intermediate outputs
  - useful for debugging and validation of pipeline stages

### Validation and diagnostics

- add lightweight automated checks for core deterministic flows
- introduce small regression tests for parser, cleaning, preview cache and render preprocessing
- add a one-command local smoke validation workflow
- introduce structured logging system (file-based, timestamped) for debugging and diagnostics

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

## Backlog / Technical improvements

- low priority: optimize preview cache invalidation so instrument changes do not force regeneration when chord diagrams are disabled
- not part of the current roadmap focus

## Distribution & installation (future)

- improve local installation workflow:
  - use installer-based setup (MSI / NSIS)
  - allow upgrade over existing installations
  - support uninstall / repair flows
- automatic updates (long-term):
  - evaluate auto-update mechanisms
  - consider infrastructure and UX implications

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
