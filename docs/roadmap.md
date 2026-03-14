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

### Block 1 - MVP corrections

1. Replace the temporary export prompt with a proper Tauri file save dialog.
2. Add a visible loading state while preview is being generated.

### Block 2 - User interface

3. Introduce a clean user-facing view separate from the developer Playground.
4. Add navigation between:
   - User interface
   - Playground (development/debug view).

### Block 3 - Minimal persistence

5. Save songs as `.cho` files.
6. Open existing `.cho` files.
7. Provide a simple folder-based list of songs.

### Block 4 - Songbook export

8. Allow exporting multiple songs into a single PDF songbook using the ChordPro CLI.

### Block 5 - UX polish

9. Improve preview and export feedback messages.
10. Preserve the last valid preview if regeneration fails.
11. Clean up the Playground UI (layout, redundant labels, language consistency).

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
