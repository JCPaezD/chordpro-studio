# Development Notes

This document records development-time decisions, assumptions and items that require later review.

## Assumptions Policy

When implementing features, the system may occasionally need to make assumptions.

Any assumption made during development must be recorded in this document under an **Assumptions** section.

This ensures that important design decisions are not silently introduced without later review.

Each assumption entry should include:

- date
- context
- assumption made
- reason for the assumption
- whether it requires later validation

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

## Assumptions

- date: 2026-03-08
- context: moving the conversion runtime prompt from `docs/prompts.md` to `app/prompts/conversion.prompt.md`
- assumption made: the runtime prompt content starts at `Actúa...` and ends at `[PEGA AQUÍ TU CANCIÓN]`, excluding the `prompts.md` heading and `## Prompt Storage Strategy` section
- reason for the assumption: those parts are documentation metadata and storage guidance, not runtime prompt text
- whether it requires later validation: yes

- date: 2026-03-08
- context: fixing encoding in `app/prompts/conversion.prompt.md`
- assumption made: mojibake shown in terminal output is caused by console display encoding, so UTF-8 byte validation is the source of truth for correctness
- reason for the assumption: direct UTF-8 decoding checks confirmed correct accented content while console rendering remained inconsistent
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing `ChordProParser` in `app/src/services/parser/ChordProParser.ts`
- assumption made: parser output must follow the currently implemented TypeScript domain interfaces (which do not yet include all fields listed in `docs/domain-model.md`), and unknown section labels from `{comment: ...}` are mapped to section type `custom`
- reason for the assumption: architecture and domain docs are ahead of the current code model, and parser must still emit a valid `Song` object compatible with existing interfaces
- whether it requires later validation: yes

- date: 2026-03-08
- context: aligning `ChordProParser` output strictly with `docs/domain-model.md`
- assumption made: parser runtime output should prioritize documentation shape (`Line` with only `segments`, `Segment` with `lyric`) even though current TypeScript interfaces are not yet fully aligned
- reason for the assumption: task explicitly requires strict domain-model alignment and also forbids modifying existing domain interfaces in this change
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing `PromptLoader` in `app/src/utils/PromptLoader.ts`
- assumption made: prompt lookup should support `app/prompts` from repository root and a runtime override via `CHORDPRO_PROMPTS_DIR`; unresolved template variables should remain unchanged in rendered output
- reason for the assumption: this keeps runtime behavior deterministic across Node/Tauri contexts while avoiding silent data loss from missing render variables
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing `OpenAIProvider` and `GeminiProvider` in `app/src/adapters/llm/`
- assumption made: initial provider calls target OpenAI `POST /v1/responses` and Gemini `v1beta ... :generateContent`, extracting plain text from `output_text`/content parts
- reason for the assumption: this is a simple deterministic HTTP integration that satisfies current MVP requirements without external SDK dependencies
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing conservative `CleaningService` in `app/src/services/cleaning/CleaningService.ts`
- assumption made: known website boilerplate removal is limited to exact, line-level matches from the documented examples to avoid deleting possible musical text; HTML cleanup removes tag markup but preserves remaining visible characters
- reason for the assumption: conservative cleaning must prioritize musical information preservation and alignment safety
- whether it requires later validation: yes

- date: 2026-03-08
- context: updating `app/prompts/conversion.prompt.md` for PromptLoader variables
- assumption made: the new `User preferences` block should be appended near the final input area, immediately before `{{song_text}}`, while preserving all existing conversion rules and instruction sections
- reason for the assumption: architecture docs define both `{{song_text}}` and `{{user_preferences}}` as current prompt variables but do not mandate an exact insertion line
- whether it requires later validation: yes

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