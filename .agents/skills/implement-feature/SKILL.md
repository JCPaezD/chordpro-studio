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

2. Create a Conventional Commit describing the change.

Do NOT push unless explicitly requested.


# Output Expectations

When finishing implementation:

Explain briefly:

- files modified
- architectural decisions taken
- verification steps performed

Ensure build checks pass before finishing.