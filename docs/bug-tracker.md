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
The User View should present the active left panel (`Convert` or `Songbook`) at the same visual height as the `Preview` panel in two-column desktop layout, but that alignment is not reliable across content states.

Impact:
The layout feels inconsistent. In particular:

- `Convert` may remain visibly shorter than `Preview`
- expanding the collapsible ChordPro editor can push content beyond the block instead of the layout adapting cleanly
- the empty `Songbook` placeholder does not align as cleanly as the populated state

Current behavior:
The view is functionally correct, but strict height parity between left and right panels is not solved in a robust way.

Expected behavior:
In desktop two-column layout, the active left panel and the Preview panel should align cleanly without overflow or placeholder misalignment.

Temporary decision:
Leave the current stable layout in place and defer strict panel-height synchronization to a later focused layout pass. Several CSS and runtime-sync attempts were tested and did not produce a robust solution without regressions.

Priority: Low
Status: Open
