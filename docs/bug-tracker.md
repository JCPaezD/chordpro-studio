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
Improve prompt instructions and add output validation in the application.

Priority: High  
Status: Open

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
Strengthen prompt instructions and later add output validation.

Priority: High  
Status: Open

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
Modify prompt later to allow conversion with missing metadata.

Priority: High  
Status: Open

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