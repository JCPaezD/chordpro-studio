---
name: implement-feature
description: Use this skill when implementing or modifying clear features, fixes, behavior, UI, documentation, or workflow changes in this repository. It enforces architecture rules, documentation-first discipline, validation, human UI/UX checkpoints, and Git safety. Use the smallest safe implementation path for clear small changes; route to refine-item, plan-version, design-spec, breakdown-feature, or debug-root-cause first when ambiguity, planning, design, task slicing, or diagnosis is still needed.
---

# Implement Feature Skill

This skill defines the standard workflow for implementing features in this repository.

See `.agents/workflow.md` for the shared workflow map.

Use it whenever a task involves:

- implementing a new feature
- modifying existing behavior
- extending UI functionality
- integrating new functionality with the existing pipeline

Do not use it for:

- trivial formatting changes
- small documentation edits
- very small bug fixes that clearly affect a single line

Route away from this skill first when:

- the input is still chaotic or mixed enough for `capture-item`
- the item exists but its meaning or scope is ambiguous enough for `refine-item`
- roadmap placement, version scope or macro-slicing belongs in `plan-version`
- behavior or technical approach needs `design-spec`
- a designed change needs executable splitting through `breakdown-feature`
- the root cause is unclear enough for `debug-root-cause`


# Project Context

This repository implements a tool for converting chord sheets into valid ChordPro format and exporting them using the ChordPro CLI.

Main stack:

- Vue 3
- TypeScript
- Vite
- Tauri
- ChordPro CLI
- Gemini LLM

Core pipeline:

Raw text  
-> cleaning rules  
-> LLM conversion  
-> ChordPro text  
-> preview/export via ChordPro CLI


# Architecture Rules

Before implementing anything:

1. Inspect the repository structure.
2. Read project documentation, especially:
   - docs/architecture.md
   - docs/dev-notes.md
   - docs/roadmap.md

Always reuse the existing architecture.


Never:

- duplicate pipeline logic
- create parallel implementations of the conversion pipeline
- introduce alternative preview mechanisms
- modify backend commands unless explicitly required


Preview system:

Preview generation must reuse the existing mechanism:

ChordPro CLI -> preview.pdf -> returned bytes -> Blob URL -> WebView PDF viewer

Do not introduce new PDF viewers or preview systems.


Export system:

Export must reuse the current export logic:

- Tauri native save dialog
- PDF export via ChordPro CLI
- CHO export using raw ChordPro text


# Implementation Workflow

Use the smallest safe implementation path.

For a clear small change:

1. Inspect only the relevant files and docs.
2. Make the minimal coherent change.
3. Run the most relevant validation.
4. Report whether documentation was needed.

For normal feature work:

1. Inspect the repository and relevant files.
2. Understand how the existing architecture implements the required functionality.
3. Reuse existing services, adapters, and UI patterns whenever possible.
4. Implement the minimal change required to complete the feature.
5. Ensure the implementation remains consistent with existing code structure.

For formal closure work:

1. Complete implementation and relevant automatic validation.
2. Stop for human validation when UI, UX, layout, dialogs, interaction flow or visual behavior changed.
3. Update documentation needed to keep repo state truthful.
4. Prepare commits only when explicitly requested.

# Documentation First

Keep documentation aligned with real decisions and changes.

Do not require a manual user request before surfacing documentation impact. Skip documentation only when the change is trivial, mechanical, purely local, or does not leave durable project knowledge.

Update or propose updates when implementation changes:

- architecture
- domain model
- pipeline behavior
- persistence or filesystem behavior
- UX rules or stable interaction behavior
- workflow rules
- roadmap scope or status
- validation or release process

Use:

- `docs/dev-notes.md` for stable technical, UX, workflow or operational rules
- `docs/roadmap.md` for planned, pending, completed or moved product work
- architecture/domain docs when the underlying model or system structure changes

During active UI/UX work, do not move roadmap items to completed or finalize closure docs before human validation.


# Assumptions Tracking (Filtered)

When implementing a feature:

- identify only meaningful assumptions:
  - behavior decisions not explicitly defined
  - fallback strategies
  - heuristics or threshold choices
  - simplifications caused by missing data or missing inputs
  - non-obvious UX decisions
- do not track:
  - trivial implementation details
  - naming choices
  - obvious or easily reversible decisions
- do not log assumptions continuously during execution
- collect them during implementation and surface them only in the final summary under `Assumptions made`
- use this format when reporting them:
  - `[assumption] short description`
    `impact: low | medium | high`
    `revisitable: yes | no`
- if an assumption matters long-term, update `docs/dev-notes.md` selectively; do not flood the file with temporary or low-signal entries

# Bug Diagnosis And Debugging

## Stall Detection And Escalation (Critical)

If an implementation attempt does not converge after a small number of reasonable iterations:

- do not continue applying speculative fixes
- do not try multiple alternative patches blindly
- do not expand the scope of changes to unrelated parts of the system

Instead:

1. Stop making further code changes.
2. Analyze why the previous attempts failed:
   - incorrect assumptions
   - wrong file or layer
   - missing runtime evidence
   - UI vs state mismatch
3. Explain the likely cause of failure.
4. Explicitly state that the problem requires root-cause debugging.

Then:

- propose switching to a debugging phase
- suggest isolating the issue as a bug if it is blocking the current feature
- avoid mixing further implementation attempts with unresolved uncertainty

Important:

- prefer stopping early over accumulating multiple incorrect fixes
- do not try to "eventually get it right" through repeated small adjustments

Once stall detection has been triggered, debugging must follow an evidence-driven process:

- do not keep iterating blindly on hypotheses with no new evidence
- pause and inspect the real runtime behavior before making more structural changes
- add temporary, scoped diagnostics when needed, such as logs, counters, or state traces
- prefer structured debug output that makes event order and state transitions easy to follow
- use diagnostics for any stubborn bug class, not only UI issues:
  - rendering and layout bugs
  - async or timing bugs
  - cache invalidation problems
  - process or CLI integration issues
  - desynchronization between logical state and visible behavior
- once the actual cause is identified, remove the temporary diagnostics before closing the task

Escalation guideline:

- after a small number of reasonable attempts, switch from trial-and-error to evidence-driven debugging
- favor one good diagnostic pass over many speculative fixes

Final rule:

- once stall detection has been triggered, do not return to implementation in the same pass
- complete the debugging analysis first, or stop and wait for user direction


# Editing Strategy And Patch Robustness

When modifying code:

- prefer replacing full logical blocks such as functions, components, or composables when the change is non-trivial
- avoid string-based or line-by-line replacements when the file may already contain intermediate modifications
- if a patch fails once or produces an unexpected diff, do not keep retrying the same approach; switch to rewriting the full block
- if the patch tool itself fails because of sandbox, setup, or other editing infrastructure issues, do not keep retrying variants of the same patch; re-read the file and switch to a single deterministic rewrite of the affected block or file
- re-read the current file content before applying critical edits and assume it may have changed since the initial inspection
- avoid chained partial patch attempts; repeated small fixes increase the risk of subtle bugs
- avoid regex-based fixes unless the transformation is trivial and strictly scoped
- avoid line-index-based edits except as a last resort
- when changing central or complex logic, prioritize clarity and determinism over the smallest possible diff
- avoid parallel edits or commands that compete for the same file or resource
- keep git index operations such as `git add` and `git commit` strictly sequential to avoid transient lock conflicts
- these rules reinforce the project-wide shell, editing, and Git safety policy in `AGENTS.md`


# UI Changes

When implementing UI features:

- follow the existing Vue component structure
- follow the existing Tailwind styling patterns
- prefer minimal and consistent layouts
- reuse existing state and services where possible

Avoid introducing new global state unless absolutely necessary.

## Visual Validation Tooling

Choose the validation surface by what must be observed:

- use the Codex integrated browser for shared visual review with the user, especially when the user needs to see the same Vite screen, interact, or point to a specific UI detail
- use Playwright for Codex-owned screenshots, controlled desktop/mobile viewport checks, repeatable layout verification, responsive review, and redesign reference captures that do not require user interaction
- ask the user for screenshots from the real Tauri app when the behavior depends on Tauri runtime, native dialogs, desktop window behavior, WebView/PDF viewer differences, filesystem integration, or APIs unavailable in Vite

Start Vite when using either the integrated browser or Playwright for frontend UI review. Playwright screenshots do not replace the required human validation checkpoint for UI, UX, layout, dialog or interaction-flow changes.


# Model Usage

The project may use different LLM models depending on the context.

Playground:
- dynamic model selector may be used

User interface:
- simplified model selection may be used


# Git Workflow

The repository uses a controlled Git workflow.

When implementing a feature:

Do NOT create commits automatically unless explicitly instructed.

Leave all changes uncommitted for manual review.

Manual validation and user confirmation take precedence over autonomous task wording:

- if a task involves UI, UX, layout, dialogs, interaction flow, visual behavior, or any change that reasonably benefits from human verification, do not treat the task as fully closed immediately after implementation
- this rule still applies even if the task prompt asks to finish everything in one autonomous pass, because design-side prompts may over-specify closure expectations
- in these cases, stop after implementation plus relevant automated checks, present the result for manual validation, and wait for explicit user confirmation before treating the feature as complete
- do not move roadmap items from pending to completed/current-status, do not finalize closing documentation, and do not prepare final commits until that confirmation arrives
- only skip this confirmation gate for changes that are clearly mechanical, low-risk, and sufficiently validated without manual interaction

When a feature is confirmed as complete:

1. Update documentation if needed:
   - docs/dev-notes.md
   - docs/roadmap.md

2. Preserve roadmap history when updating docs:
   - Current roadmap should reflect pending work only.
   - During active implementation, avoid moving roadmap items from pending sections to completed/current-status sections before the feature is reviewed and ready to close.
   - Move roadmap items out of pending sections during the closing or pre-commit phase, not during early implementation, unless the user explicitly asks for it.
   - When removing an item from pending sections, do not let it disappear without trace.
   - Record the completed or resolved outcome in Current status or another appropriate completed/historical section.

3. Create a Conventional Commit describing the change.

Do NOT push unless explicitly requested.

Sequential closing summaries must reflect the real collaboration flow:

- when asked for a sequential summary, describe the evolution of the task with the user: initial request, implementation direction, iterations, adjustments, validation, and final outcome
- do not turn that summary into an internal execution log of hidden micro-steps when the task was already well defined by the user
- assumptions belong in the dedicated `Assumptions made` section instead of being mixed into the sequential narrative


# Versioning Rules

Version management follows these rules:

- `src-tauri/tauri.conf.json` is the source of truth for the application version
- keep these files in sync with the same version:
  - `package.json`
  - `app/package.json`
  - `src-tauri/Cargo.toml`
- if version-related dependencies are refreshed through Cargo, allow `src-tauri/Cargo.lock` to update as part of the build; do not hand-edit it
- always update the version before local rebuilds when practical, and before releases without exception
- use incremental numeric versions such as `1.3.0 -> 1.3.1 -> 1.3.2` for local iterations, and `1.3.x -> 1.4.0` for the next planned version

Never:

- reuse the same version for multiple builds
- change the bundle identifier
- change the product name

Purpose:

- ensure installer upgrades work correctly
- avoid version conflicts between builds


# Build Types

Two build types are recognized:

### Rebuild (local use)

- purpose: personal testing or iteration
- actions:
  - increment version
  - build the app
- preferred validation path for installer upgrade testing: use MSI builds consistently
- not required:
  - release notes
  - release metadata polishing

### Release (version milestone)

- purpose: stable version or distribution milestone
- actions:
  - increment version
  - ensure metadata is correct
  - generate release notes
  - build the app
- keep installer type consistent when validating upgrades; compare MSI-to-MSI or NSIS-to-NSIS rather than mixing installer families


# Release Notes

For release builds:

- generate a structured summary of changes since the last release
- use commits, roadmap changes, and dev-notes when relevant as source material
- keep the notes concise and user-oriented
- group changes by type when it improves readability, such as features, improvements, and fixes
- avoid low-level implementation details unless they matter to users

Do not generate release notes for local rebuilds.


# Release Artifact Workflow

When builds or release artifacts are requested:

- treat `src-tauri/target/` as transient Tauri output, not as the canonical place to keep final artifacts
- copy the final human-facing artifacts to `releases/` for easy access
- group each release or rebuild under a semantic version subfolder such as `releases/vX.Y.Z/`
- keep the version folder name aligned with full three-segment versioning even for `.0` releases (for example `v1.1.0`, not `v1.1`)
- inside each version folder, keep the portable folder, matching zip, and installer artifacts together
- when preparing a portable build, prefer a folder and zip pair inside that version folder rather than placing artifacts loose at the top level
- if installer bundles are needed, copy the generated NSIS/MSI artifacts from `target` into the same version folder with consistent names
- keep release artifacts untracked in Git and rely on the existing ignore rules instead of staging them


# Output Expectations

When finishing implementation:

Explain briefly:

- files modified
- architectural decisions taken
- assumptions made (only meaningful ones, using the same format as `docs/dev-notes.md`)
- verification steps performed

Use the user's conversation language for summaries and review notes; in this project, default to Spanish when the user is working in Spanish. Keep code, commands, commit messages, technical identifiers, and persistent documentation text in their target language.

Ensure build checks pass before finishing.

