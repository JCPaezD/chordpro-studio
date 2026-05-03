# Codex Workflow Map

This document is the shared map for the repo-local workflow skills.

Use the latest safe skill in the workflow, and only move earlier when real ambiguity requires it. The full chain is available, but it is not the default path for every task.

## Core Flow

Typical maximum flow:

`capture-item -> refine-item -> plan-version -> design-spec -> breakdown-feature -> implement-feature`

Skip steps when the input is already clear enough:

- raw or mixed notes -> `capture-item`
- captured but meaningfully ambiguous item -> `refine-item`
- roadmap, version, priority or block decision -> `plan-version`
- selected item that needs behavior or technical design -> `design-spec`
- designed work too large, mixed or risky for one implementation pass -> `breakdown-feature`
- clear code, UI, behavior or documentation change -> `implement-feature`
- unclear or persistent bug diagnosis -> `debug-root-cause`
- local build, version bump, release notes, artifacts or publication -> `release-workflow`

## Skill Boundaries

### Capture vs Refine

`capture-item` answers: what is here, what should be preserved, and what is the next step?

`refine-item` answers: this item already exists, but what exactly does it mean?

Use `capture-item` for messy input. It may do light clarification and exploratory design only to decide whether an item is real or worth preserving. Do not force `refine-item` after capture when the item is already clear.

Use `refine-item` only when a recognizable item still has scope, intent, included/excluded behavior, or edge-case ambiguity that blocks safe planning or design.

### Refine vs Design

`refine-item` defines the problem or item.

`design-spec` defines the solution shape.

Exploratory design is allowed during capture or refinement when it helps validate whether an item is sensible. Switch to `design-spec` once the conversation starts deciding behavior, architecture, components, contracts, implementation rules, or durable edge cases.

### Plan vs Design

`plan-version` decides what belongs where and when.

`design-spec` prepares one selected item or slice for implementation.

Use `plan-version` when the question is priority, roadmap placement, version scope, grouping, ordering or what should wait. Use `design-spec` when the question is how a selected item should work.

### Plan vs Breakdown

`plan-version` owns macro-slicing for real versions or work blocks:

- selected areas or slices
- includes and excludes
- general order
- strong dependencies
- next step per slice

`breakdown-feature` owns executable task slicing after there is enough design clarity. It should not decide what belongs in the version.

### Design vs Breakdown

`design-spec` may include a short high-level implementation plan.

`breakdown-feature` is only needed when the designed work is too large, mixed, risky or dependency-heavy for one clean implementation pass.

## Planned Version Execution

When a version is already planned in `docs/roadmap.md`, do not create a giant version-wide `design-spec`.

Recommended path:

`planned roadmap block -> plan-version for lightweight resumption/macro-slicing if needed -> design-spec per slice that needs design -> breakdown-feature when a slice needs executable splitting -> implement-feature`

If the roadmap block already has enough macro-slicing, start directly with the first slice's `design-spec`, `breakdown-feature`, or `implement-feature`.

## Documentation Rules

Keep documentation aligned with the real repo state.

Skip documentation only for trivial, mechanical or purely local changes that do not leave durable project knowledge.

Propose or apply documentation updates when work changes:

- architecture
- domain model
- pipeline behavior
- persistence or filesystem behavior
- UX rules or stable interaction behavior
- workflow rules
- roadmap scope or status
- validation or release process

For UI, UX, layout, dialogs, interaction flow or visual behavior, stop for human validation before treating roadmap closure or final documentation closure as complete.

## Output Discipline

Each skill should stop as soon as its output is sufficient for the next safe step.

Avoid process inflation:

- do not capture what is already clear
- do not refine for polish
- do not plan what is already placed
- do not design obvious local changes
- do not break down work that fits one clean implementation pass
