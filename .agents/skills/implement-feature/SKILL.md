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
→ cleaning rules  
→ LLM conversion  
→ ChordPro text  
→ preview/export via ChordPro CLI


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

ChordPro CLI → preview.pdf → returned bytes → Blob URL → WebView PDF viewer

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


# Editing Strategy And Patch Robustness

When modifying code:

- prefer replacing full logical blocks such as functions, components, or composables when the change is non-trivial
- avoid string-based or line-by-line replacements when the file may already contain intermediate modifications
- if a patch fails once or produces an unexpected diff, do not keep retrying the same approach; switch to rewriting the full block
- re-read the current file content before applying critical edits and assume it may have changed since the initial inspection
- avoid chained partial patch attempts; repeated small fixes increase the risk of subtle bugs
- avoid regex-based fixes unless the transformation is trivial and strictly scoped
- avoid line-index-based edits except as a last resort
- when changing central or complex logic, prioritize clarity and determinism over the smallest possible diff


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

When a feature is confirmed as complete:

1. Update documentation if needed:
   - docs/dev-notes.md
   - docs/roadmap.md

2. Preserve roadmap history when updating docs:
   - Current roadmap should reflect pending work only.
   - When removing an item from pending sections, do not let it disappear without trace.
   - Record the completed or resolved outcome in Current status or another appropriate completed/historical section.

3. Create a Conventional Commit describing the change.

Do NOT push unless explicitly requested.


# Output Expectations

When finishing implementation:

Explain briefly:

- files modified
- architectural decisions taken
- verification steps performed

Ensure build checks pass before finishing.
