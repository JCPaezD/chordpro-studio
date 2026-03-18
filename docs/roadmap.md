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

## Current roadmap

### v1 - Finalization

14. Refactor the app into a fixed-height layout with a non-scrollable header, no global page scroll and panel-local scrolling.
15. Revalidate `BUG-10` after the layout refactor.
16. Resolve the remaining User View panel height sync issue tracked as `BUG-10`.
17. Run a full manual review of the application after the layout refactor.
18. Apply a UI consistency pass to the User View.
19. Clean up the Playground UI (layout, redundant labels, language consistency).

### v1.1 - Post-release improvements

- Add a side menu to the Playground with toggles to show or hide panels as a developer-oriented, non-blocking UX improvement.
- persist the last active view (`User` / `Playground`) across sessions; current behavior should continue to default to `Convert` in `User` view until that is implemented
- allow aborting an ongoing conversion request from the UI in both `User` and `Playground`; medium priority and not required for v1 completion
- Improve prompt handling of chord sequences with separators (e.g. "[Am] - [F] - [G]") to avoid treating separators as lyrics, complemented by minimal safe post-processing when needed.
- Normalize extracted metadata (title, artist, etc.) locally in the application to ensure consistent casing and filename generation.
- Resolve Vite warning related to `node:fs/promises` usage in PromptLoader.ts.

## v2 - Core feature expansion

- scraping
- chord analysis
- layout optimization
- song library

### Performance improvements

- Introduce caching for preview PDF generation to avoid unnecessary CLI executions when no changes are detected.

### Export improvements (future)

- Songbook cover support:
  - auto-generated cover (title, date, `Generated with ChordPro Studio`)
  - custom PDF cover support
- user-configurable ChordPro styles (UI-based)
  - chord diagram visibility, instrument and placement
- advanced export options:
  - song ordering
  - song selection (checkboxes)
  - table of contents configuration

---

## Phase 3 - Advanced AI

Features:

- AI preference learning
- conversational adjustments
- automatic layout decisions

---

## Phase 4 - Product Expansion

Features:

- mobile client
- songbook viewer
- performance mode
- setlists
- cloud sync
