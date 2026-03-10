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

- date: 2026-03-08
- context: implementing `app/src/services/conversion/ConversionService.ts`
- assumption made: new conversion flow returns raw ChordPro text from the provider and coexists temporarily with older placeholder/contracts that still model conversion as `Song`
- reason for the assumption: task requires prompt-driven LLM conversion output as string and explicitly excludes parsing from this service
- whether it requires later validation: yes

- date: 2026-03-08
- context: cleanup of scaffold-era services compatibility layer
- assumption made: shared `app/src/services/contracts.ts` and placeholder wrapper exports are obsolete now that concrete `CleaningService` and `ConversionService` are implemented, while `analysis` should remain contract-only until a real implementation exists
- reason for the assumption: architecture now documents concrete service flow, and legacy wrappers introduced type/API drift from real implementations
- whether it requires later validation: yes

- date: 2026-03-08
- context: implementing developer Pipeline Playground view
- assumption made: the playground should prefer `OpenAIProvider` with model `gpt-4.1-mini`, fall back to `GeminiProvider` with model `gemini-1.5-flash`, and show a runtime error if no API key is configured
- reason for the assumption: the task requires reusing existing service implementations and opening directly into a developer debugging view without adding new configuration UI
- whether it requires later validation: yes

- date: 2026-03-08
- context: making PromptLoader compatible with the developer Playground running in the Vue app
- assumption made: prompt files should be loaded from bundled `app/prompts/*.prompt.md` at runtime in the browser build, with filesystem reads kept only as a fallback for Node-like environments
- reason for the assumption: static Node imports break Vite browser builds once ConversionService is used from UI code
- whether it requires later validation: yes

- date: 2026-03-08
- context: fixing repository-level npm command failures
- assumption made: npm commands are expected to be executed from repository root, so root workspace scripts should proxy to `app/` (`npm install`, `npm run build`, `npm run dev`)
- reason for the assumption: failures were caused by missing root `package.json`, while the functional app already lived under `app/`
- whether it requires later validation: yes

- date: 2026-03-08
- context: enabling LLM API key detection in Vite dev browser runtime
- assumption made: browser-side development uses `VITE_OPENAI_API_KEY` / `VITE_GEMINI_API_KEY` from `app/.env.local`, while Node/Tauri runtime keeps `OPENAI_API_KEY` / `GEMINI_API_KEY` via `process.env`
- reason for the assumption: Vite only exposes prefixed variables to client code and does not provide raw process environment variables in browser runtime
- whether it requires later validation: yes

- date: 2026-03-08
- context: fixing missing API key detection in the Pipeline Playground
- assumption made: repository-root `.env.local` is the canonical development env file, so Vite should load env values from repo root (`envDir: \"..\"`) while providers resolve `process.env` first and then `import.meta.env`
- reason for the assumption: the active developer workflow runs npm commands from repository root and already stores Vite keys in root `.env.local`
- whether it requires later validation: yes

- date: 2026-03-08
- context: resolving Gemini model-not-found errors in the Playground
- assumption made: model IDs should be selected from live `v1beta/models` discovery for the active API key, and `gemini-flash-latest` is the stable text-generation alias to use for this project
- reason for the assumption: hardcoded legacy model names were not available to the current key/version and caused runtime 404 failures
- whether it requires later validation: yes

- date: 2026-03-10
- context: redesigning the runtime conversion prompt for pipeline use
- assumption made: the conversion LLM must behave as a deterministic transformer that returns only valid ChordPro and must not switch into conversational or metadata-request behavior
- reason for the assumption: the pipeline now depends on automatic downstream parsing and cannot safely process explanatory or blocking responses
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
