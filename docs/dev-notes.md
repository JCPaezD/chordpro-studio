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
- context: adding retry handling for temporary Gemini failures in `GeminiProvider`
- assumption made: Gemini requests should attempt 1 initial request plus up to 3 retries for HTTP 429, HTTP 503 and network failures, using exponential backoff (500ms, 1000ms, 2000ms), and propagate `retryLog` to the Playground for debugging whether the request eventually succeeds or fails
- reason for the assumption: temporary provider errors should not fail the pipeline immediately, and retry visibility is necessary to debug instability from the developer Playground without relying on browser console logs
- whether it requires later validation: yes

- date: 2026-03-10
- context: redesigning the runtime conversion prompt for pipeline use
- assumption made: the conversion LLM must behave as a deterministic transformer that returns only valid ChordPro and must not switch into conversational or metadata-request behavior
- reason for the assumption: the pipeline now depends on automatic downstream parsing and cannot safely process explanatory or blocking responses
- whether it requires later validation: yes

- date: 2026-03-11
- context: refining chord alignment behavior in `app/prompts/conversion.prompt.md`
- assumption made: chord alignment issues from chord-line plus lyric-line input can be resolved at the prompt layer by explicitly treating source text as monospaced for column calculation while forcing final lyric lines to start at column 0 with no artificial indentation
- reason for the assumption: manual tests with real chord sheets showed that explicit prompting materially improved chord placement and removed indentation artifacts without adding a separate deterministic alignment step
- whether it requires later validation: yes

- date: 2026-03-10
- context: fixing inline ChordPro parsing in `app/src/services/parser/ChordProParser.ts`
- assumption made: each inline chord token applies to the lyric text that follows it until the next chord or end of line, while text before the first chord remains an unchorded segment
- reason for the assumption: this matches ChordPro inline notation semantics and fixes the documented BUG-08 parser inversion
- whether it requires later validation: yes

- date: 2026-03-10
- context: adding LLM output validation before parsing in `SongPipelineService`
- assumption made: the safest MVP boundary is to place `ChordProOutputValidator` between `ConversionService` and `ChordProParser` in the pipeline (`CleaningService -> ConversionService -> ChordProOutputValidator -> ChordProParser`) and reject model output unless it contains both basic ChordPro structure (tags plus inline chords) and none of the known non-ChordPro patterns such as markdown fences or explanatory lead-in text
- reason for the assumption: parser errors and contaminated Song models are easier to prevent at the pipeline boundary than to repair after parsing, and surfacing `rawOutput` there gives the Playground enough context for debugging failed conversions
- whether it requires later validation: yes

- date: 2026-03-11
- context: implementing Tauri preview and PDF export around the ChordPro CLI
- assumption made: the bundled ChordPro runtime will live under `resources/chordpro`, preview temp files will live in the application cache directory as `preview/preview.cho` and `preview/preview.pdf`, and the frontend will render that generated PDF through the native WebView PDF viewer using a browser `Blob` URL created from backend-returned PDF bytes
- reason for the assumption: the MVP needs preview and export to use the exact same ChordPro renderer output, and local asset URLs proved unreliable for embedded PDF preview in the current desktop runtime
- whether it requires later validation: yes

- date: 2026-03-14
- context: improving Playground iteration speed for conversion and preview debugging
- assumption made: the developer Playground should prefer Gemini when a Gemini key is available, default the selectable Gemini model to `gemini-2.5-flash`, preserve environment overrides through `GEMINI_MODEL` / `VITE_GEMINI_MODEL`, allow direct preview generation from the editable current `.cho` text by reusing the existing `generate_preview` backend command without re-running the LLM pipeline, and clear previous generated outputs before each run or when `Clear all` is used while preserving the raw input field
- reason for the assumption: Playground usage prioritizes fast iteration and direct CLI preview debugging, while `gemini-2.5-flash` is a fast but more reliable default than flash-lite for the conversion step and explicit result clearing makes each run easier to inspect
- whether it requires later validation: yes

## Preview and Export Notes

Preview generation now follows this flow:

`SongPipelineService` result (`chordPro`)
-> Tauri `generate_preview`
-> write `preview.cho` in the app cache directory
-> execute bundled ChordPro CLI
-> generate `preview.pdf`
-> return the PDF path plus PDF bytes to the frontend
-> create a browser `Blob` URL
-> load it through the native WebView PDF viewer

PDF export now follows this flow:

frontend native save dialog
-> suggest filename from `{artist}` / `{title}` metadata when available (`artist - title`, `artist` or `title`, else `song`)
-> if `.pdf` selected: Tauri `export_pdf`
-> write temporary `.cho`
-> execute bundled ChordPro CLI with `--output`
-> generate the requested PDF
-> if `.cho` selected: write current ChordPro text directly to disk without invoking the CLI

Preview failure behavior:

- if preview generation fails, the previous valid preview remains visible
- the frontend shows the backend error message returned by the failed preview command
- while a new preview is being generated, the shared workspace exposes a dedicated preview-loading state so both `User` and `Playground` show either a centered loading placeholder (when no preview exists yet) or a soft overlay above the current PDF without clearing the previous valid preview

Bundled CLI expectation:

- repository/development path: `resources/chordpro/chordpro(.exe)`
- packaged app path: Tauri bundled resources copied from `resources/chordpro`
- Windows runtime note: the full ChordPro distribution must be bundled, not only `chordpro.exe`, because the executable depends on Perl/runtime support files shipped with the installation

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

- date: 2026-03-14
- context: introducing a user-facing mode alongside the existing Playground
- assumption made: the app should keep a single shared UI workspace for raw input, ChordPro text, preview and export state so switching between `User` and `Playground` mode does not reset data, while the new User View exposes only a simplified `Fast` / `Quality` Gemini selector mapped to `gemini-flash-lite-latest` and `gemini-flash-latest`
- reason for the assumption: the task requires reusing the exact same pipeline, preview and export mechanisms without duplicating architecture, and preserving state across view switches is simplest when both views operate on the same workspace
- whether it requires later validation: yes

## User View Notes

The application now has two UI modes:

- `User`: a minimal two-column interface for normal workflow (`raw input -> convert -> preview -> export`)
- `Playground`: the existing developer/debugging interface with intermediate pipeline stages

Both modes reuse the same front-end workspace state and the same underlying pipeline, preview and export adapters.

User View model selector:

- `Fast` -> `gemini-flash-lite-latest`
- `Quality` -> `gemini-flash-latest`

The User View also exposes a collapsible editable ChordPro source panel that reuses the same `chordProText` state used for preview and export, and can regenerate the preview directly from the edited source without re-running the full pipeline.
