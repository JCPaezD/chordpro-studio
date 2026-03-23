---
name: implement-feature
description: Use this skill when implementing or modifying features in this repository. It enforces the project's architecture rules, development workflow, and Git practices. Do not use for trivial edits such as simple text changes unless they affect architecture or behavior.
---

# Implement Feature Skill

This skill defines the standard workflow for implementing features in this repository.

Use it whenever a task involves:

- implementing a new feature
- modifying existing behavior
- extending UI functionality
- integrating new functionality with the existing pipeline

Do not use it for:

- trivial formatting changes
- small documentation edits
- very small bug fixes that clearly affect a single line


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

Follow this process:

1. Inspect the repository and relevant files.
2. Understand how the existing architecture implements the required functionality.
3. Reuse existing services, adapters, and UI patterns whenever possible.
4. Implement the minimal change required to complete the feature.
5. Ensure the implementation remains consistent with existing code structure.


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

When a bug resists the first reasonable implementation attempts:

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


# UI Changes

When implementing UI features:

- follow the existing Vue component structure
- follow the existing Tailwind styling patterns
- prefer minimal and consistent layouts
- reuse existing state and services where possible

Avoid introducing new global state unless absolutely necessary.


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

Ensure build checks pass before finishing.

