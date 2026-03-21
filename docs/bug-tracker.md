# Bug Tracker

This document tracks known issues discovered during development.

It is used to ensure that bugs identified during testing are documented before fixes are implemented.

---

## BUG-01 — LLM returns explanations together with ChordPro

Layer: LLM / Conversion

Description:
The LLM sometimes returns explanatory text and notes together with the generated ChordPro code.

Impact:
Parser receives non-ChordPro text which contaminates the Song model.

Current behavior:
The full response (including explanations) is passed to the parser.

Expected behavior:
The LLM should return only valid ChordPro text.

Temporary decision:
Resolved by the redesigned conversion prompt, which now enforces deterministic ChordPro-only output with no explanations.

Priority: High  
Status: Resolved

---

## BUG-02 — LLM output contains Markdown code fences

Layer: LLM / Conversion

Description:
The model sometimes wraps the ChordPro output in markdown fences such as ```chordpro.

Impact:
Parser interprets the fences as lyrics or plain text.

Current behavior:
Markdown fences are not filtered.

Expected behavior:
The LLM should not include markdown formatting.

Temporary decision:
Resolved by the redesigned conversion prompt, which now explicitly forbids markdown code fences and other non-ChordPro output.

Priority: High  
Status: Resolved

---

## BUG-03 — Conversion stops when metadata is missing

Layer: Prompt design / Conversion

Description:
The prompt instructs the LLM to stop conversion if metadata fields are missing.

Impact:
The pipeline cannot produce a partial conversion during early testing.

Current behavior:
The model asks the user for metadata instead of converting.

Expected behavior:
Conversion should proceed even if metadata is missing.

Temporary decision:
Resolved by the redesigned conversion prompt, which now continues conversion when metadata is missing and omits unavailable fields.

Priority: High  
Status: Resolved

---

## BUG-04 — Parser receives non-ChordPro text

Layer: Pipeline / Parsing

Description:
Because the LLM output may contain explanations, the parser receives text that is not valid ChordPro.

Impact:
Song model contains explanatory text lines.

Current behavior:
Parser processes all text blindly.

Expected behavior:
The system should detect invalid responses before parsing.

Temporary decision:
Resolved by introducing `ChordProOutputValidator` between conversion and parsing. It validates LLM output before `ChordProParser`, includes `rawOutput` in validation errors for debugging, and the Playground now displays that raw LLM output when validation fails.

Priority: Medium  
Status: Resolved

---

## BUG-05 — Gemini API sometimes returns 503 (high demand)

Layer: LLM provider

Description:
The Gemini API may respond with status 503 when the model experiences high demand.

Impact:
Pipeline execution fails temporarily.

Current behavior:
The request fails immediately.

Expected behavior:
The system should retry the request.

Temporary decision:
Resolved by adding automatic retry handling in `GeminiProvider`. Retries now occur for HTTP 429, HTTP 503 and network errors, using exponential backoff delays of 500ms, 1000ms and 2000ms. Retry attempts are collected in `retryLog`, and the Playground displays both retry attempts and the final error when retries are exhausted.

Priority: Medium  
Status: Resolved

---

## BUG-06 — Playground layout differs from intended pipeline layout

Layer: UI / Developer tooling

Description:
The developer Playground currently displays pipeline stages vertically instead of horizontally.

Impact:
Developer visualization does not match the intended pipeline timeline design.

Current behavior:
Vertical layout.

Expected behavior:
Horizontal pipeline visualization.

Temporary decision:
Resolved by redesigning the Playground into a horizontal pipeline layout and adding direct clipboard actions for faster debugging.

Priority: Low  
Status: Resolved

---

## BUG-07 — LLM does not preserve real chord alignment from chord-line spacing

Layer: LLM / Conversion

Description:
When the input uses the common format of one chord line above one lyric line, the LLM sometimes ignores the real character offsets and places chords at musically incorrect positions in the generated ChordPro.

Impact:
Generated ChordPro may be structurally valid but musically misaligned.

Current behavior:
The model often places chords at semantically plausible positions instead of respecting exact spacing offsets from the source.

Expected behavior:
Chord placement should preserve the real intended alignment from the source chord sheet.

Temporary decision:
Resolved by refining the runtime conversion prompt with explicit chord alignment rules. The prompt now treats chord/lyric pairs as monospaced alignment guides, preserves chord column calculation, and explicitly forbids carrying visual lyric indentation into the final ChordPro output. Manual tests with real chord sheets showed substantially improved alignment.

Priority: High
Status: Resolved

---

## BUG-08 — Parser associates chords with preceding lyric fragments instead of following fragments

Layer: Parsing

Description:
For inline ChordPro such as:
[Bm]De la noche en [A]San [G]Fran[F#]cisco

the parser currently builds segments as if each chord belonged to the lyric text before it, instead of the lyric text after it until the next chord.

Impact:
The Song domain model becomes semantically incorrect and may affect future rendering, editing, or transposition features.

Current behavior:
Segments are built with inverted chord-to-lyric association.

Expected behavior:
Each chord should be associated with the lyric text that follows it until the next chord.

Temporary decision:
Resolved by updating the parser so each inline chord is associated with the lyric text that follows it until the next chord or end of line.

Priority: High
Status: Resolved

---

## BUG-09 - User View shows minimal residual vertical scroll when panels are visually empty

Layer: UI / Layout

Description:
The new User View still shows a very small residual vertical scroll in some desktop window sizes even when the two-column layout appears visually empty.

Impact:
The UI feels slightly unstable and less polished because the main view does not sit flush in the available window height.

Current behavior:
A small page-level scroll remains visible in the User View. The issue appears related to final layout sizing rather than content overflow from normal usage.

Expected behavior:
When the two-column User View is empty, it should fit the available desktop viewport without residual vertical scroll.

Temporary decision:
Resolved by restructuring the application shell so the main app owns the scroll container, the view switch remains sticky with an opaque background, and the default document margins no longer introduce residual viewport overflow. Manual verification confirmed the residual scroll is gone.

Priority: Low
Status: Resolved

---

## BUG-10 - User View panel height sync is not reliable across content states

Layer: UI / Layout

Description:
The User View should present the active left panel (`Convert` or `Songbook`) at the same visual height as the `Preview` panel in two-column desktop layout, but that alignment was not reliable across content states.

Impact:
The layout felt inconsistent. In particular:

- `Convert` could remain visibly shorter than `Preview`
- expanding the ChordPro editor could push content beyond the block instead of the layout adapting cleanly
- the empty `Songbook` placeholder did not align as cleanly as the populated state

Current behavior:
Resolved. The User View now runs inside a fixed-height, viewport-constrained layout with a non-scrollable header, no global page scroll, stable preview sizing and panel-local scrolling, so the active left panel and the `Preview` panel share the same layout height across empty, loading and populated states.

Expected behavior:
In desktop two-column layout, the active left panel and the Preview panel should align cleanly without overflow or placeholder misalignment.

Temporary decision:
Resolved by treating the problem as an application-shell layout issue instead of a component-level sizing issue. The fixed-height User View refactor removes the need for runtime height synchronization logic between panels.

Priority: Low
Status: Resolved

---

## BUG-11 - Conversion mode and Playground model selection are not persisted through AppConfig

Layer: UI / Preferences

Description:
The User View conversion flow should open in `Quality` mode by default, and the Playground should restore the last selected Gemini model. Both preferences should be loaded from AppConfig on startup and remembered after closing and reopening the app.

Impact:
The current startup behavior does not match the intended workflow and forces the user to reselect the preferred conversion mode and Playground model on every session.

Current behavior:
Resolved. User View now loads `conversionMode` from AppConfig and falls back to `quality` only when the field is missing. Playground now loads `playgroundModel` from AppConfig and falls back to `gemini-flash-latest` only when the field is missing.

Expected behavior:
The default User View mode should be `Quality`, and both preferences should be persisted and restored on startup without overwriting existing config values.

Temporary decision:
Resolved by extending the existing AppConfig shape with `conversionMode` and `playgroundModel`, loading both values before rendering their selectors, and persisting changes only on explicit user interaction. Missing config or partial config now falls back safely without creating `config.json` during startup.

Priority: Medium
Status: Resolved

---

## BUG-12 - Opening a songbook song can discard an unsaved converted song without confirmation

Layer: Workspace / Navigation

Description:
If the user has a converted song in `Convert` mode that has not been saved as `.cho`, then switches to `Songbook` and clicks a song from the list, the app does not show the same save/discard/cancel confirmation that already exists for dirty document navigation.

Impact:
A converted song can be replaced by another songbook entry without any confirmation, which risks silent loss of work.

Current behavior:
Resolved. The current `.cho` document in memory is now treated as the single source of truth for destructive replacement. The same unified save/discard/cancel confirmation flow is triggered before opening a songbook item, before running a new conversion that would replace the current `.cho`, and when the user closes the application window.

Expected behavior:
Any action that replaces the current `.cho` in memory should be treated as destructive and should go through the same confirmation flow.

Temporary decision:
Resolved by centralizing unsaved-state detection in the shared workspace through `hasUnsavedChanges`, reusing the existing confirmation modal, and wiring the same protection into songbook navigation, conversion and app close. The Tauri main-window capability also now explicitly allows `window.close` and `window.destroy`, because close interception depends on those permissions.

Priority: High
Status: Resolved

---

## BUG-13 - Preview panel exposes a Paste action that is not meaningful in User View

Layer: UI / User View

Description:
The preview block in the User View currently shows a `Paste` button even though the preview is a rendered result area and does not accept pasted content as part of the user workflow.

Impact:
The action is misleading and adds noise to the primary user interface.

Current behavior:
Resolved. The preview panel no longer exposes a `Paste` button. Clipboard paste remains available where it is meaningful (`Original text`), while the editable ChordPro source can still use normal textarea paste shortcuts.

Expected behavior:
The `Paste` action should be removed from the preview block in the User View.

Temporary decision:
Resolved by removing the preview-level `Paste` action without moving it elsewhere. The preview is a render/export surface, not an input target, so the extra action only added noise.

Priority: Low
Status: Resolved

---

## BUG-14 - Workspace state is not preserved when switching between User and Playground views

Layer: Workspace / Navigation

Description:
Switching between User View and Playground View does not reliably preserve the current workspace state. This may result in loss or reset of:

- current `.cho` content in memory
- original text input
- active document state

Impact:
Breaks continuity of work. The user expects both views to operate on the same active workspace.

Current behavior:
Resolved. `User` and `Playground` now read and write through the same shared workspace singleton, so switching views no longer recreates or desynchronizes the active document state.

Expected behavior:
Both views must share a single workspace state. Switching between them must NOT modify or reset:

- chordProText
- originalText
- active document metadata

Temporary decision:
Resolved by making `useSongWorkspace()` return a single module-level workspace instance, keeping `WorkspaceDocument`, raw input, loading state and songbook state centralized there, and making workspace initialization idempotent instead of rebuilding state per view.

Priority: High
Status: Resolved

