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
Add output validation before calling the parser.

Priority: Medium  
Status: Open

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
Implement retry logic later.

Priority: Medium  
Status: Open

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
Adjust layout later.

Priority: Low  
Status: Open

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
Do not fix yet. Document for later exploration of a local deterministic chord-alignment step before or alongside LLM conversion.

Priority: High
Status: Open

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
Fix soon in the parser implementation.

Priority: High
Status: Open
