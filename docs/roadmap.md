# Roadmap - roadmap.md

## Phase 1 — MVP

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

### Block 1 - Completed foundation

1. Replace the temporary export prompt with a proper Tauri file save dialog.
2. Introduce a clean user-facing view separate from the developer Playground.
3. Add navigation between:
   - User interface
   - Playground (development/debug view).
4. Support exporting the current song as `.cho`.
5. Add a visible loading state while preview is being generated.
6. Improve preview and export feedback messages.

### Block 2 - MVP corrections

7. Resolve the residual User View layout scroll and remaining sizing polish.

### Block 3 - Completed minimal persistence

8. Open existing `.cho` files.
9. Provide a simple folder-based list of songs.
10. Reconstruct the internal Song model by parsing `.cho` files on open.

### Block 4 - Songbook export

11. Allow exporting multiple songs into a single PDF songbook using the ChordPro CLI.

### Block 5 - UX polish

12. Clean up the Playground UI (layout, redundant labels, language consistency).

---


## Phase 2 — Workflow Improvements

Features:

- scraping
- chord analysis
- layout optimization
- song library

---

## Phase 3 — Advanced AI

Features:

- AI preference learning
- conversational adjustments
- automatic layout decisions

---

## Phase 4 — Product Expansion

Features:

- mobile client
- songbook viewer
- performance mode
- setlists
- cloud sync
