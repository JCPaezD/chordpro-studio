---
name: breakdown-feature
description: Break a designed feature, fix, or improvement into small, clear, execution-ready tasks for this repository workflow. Use when Codex already has enough design clarity but the work is still too large, mixed, or risky to implement as a single block, and needs a practical task breakdown with dependencies, completion criteria, and execution order.
---

# Breakdown Feature

Use this skill to turn a designed change into a small set of clear implementation tasks.

The goal is not to redesign the feature. The goal is to make execution easier, safer, and more incremental by splitting the work into sensible pieces.

## Core Rules

When using this skill:

- work from an already designed or otherwise sufficiently clear change
- split the work into small, meaningful tasks
- give each task one clear objective
- define completion criteria for each task
- identify only real dependencies
- propose a practical execution order
- prefer task boundaries that reduce ambiguity and implementation risk

Do not break work down just to make it look organized. Break it down only when it improves execution.

## What This Skill May Do

This skill may:

- divide a feature into implementation-ready tasks
- isolate risky or uncertain parts into their own task
- identify natural sequencing
- propose a simpler execution path
- recommend that a feature is small enough to implement without further breakdown

Do not:

- capture or refine raw ideas
- decide roadmap placement
- redesign the solution
- write code
- manage tiny implementation micro-steps with no planning value

If the design is still unclear, route the item back to `design-spec`.

## Input Expectations

Prefer inputs such as:

- a completed `design-spec`
- a clearly designed feature or fix
- a selected roadmap item that already has an agreed approach
- a question such as:
  - how should this be split into implementation tasks
  - is this too large for one implementation pass
  - what order should this work follow
  - what can be separated safely

## Output Format

Use this structure:

```md
feature: <name>

breakdown_goal:
- why this breakdown exists

tasks:
1. title: <task>
   goal:
   completion_criteria:
   dependencies:
   notes:

2. title: <task>
   goal:
   completion_criteria:
   dependencies:
   notes:

execution_order:
1. <task>
2. <task>
3. <task>

risks:
- only if they affect task splitting

next_step:
- implement-feature
```

## Task Size Rule

Prefer tasks that are:

- small
- focused on one objective
- realistically executable in one session or short block
- easy to verify as done

Avoid tasks that are:

- too broad and internally mixed
- so small that they become checklist noise
- dependent on hidden design decisions that are not yet resolved

## Dependency Rule

Only include dependencies when they materially affect execution order or task viability.

Do not invent dependency chains for cosmetic structure.

## Granularity Rule

A task is too fine if it reads like a code-edit checklist.

A task is too large if it still contains multiple distinct goals, major system areas, or unresolved decisions.

Aim for execution-ready task slices, not micro-operations and not abstract work buckets.

## Execution Strategy Rule

Prefer task boundaries that support clean, testable progress.

When sensible, prefer slices that produce meaningful visible or verifiable progress rather than separating work by artificial internal layers alone.

## Documentation Rule

This skill is conversation-first by default.

Do not update documentation by default.

Only update tracked documentation when:

- the breakdown materially changes how planned work should be represented
- the user explicitly wants the breakdown reflected in roadmap or related planning docs

## Valid Outcomes

Return one of these:

1. a clear task breakdown
2. a breakdown plus a recommendation to simplify scope
3. a decision that the work is already small enough and does not need breakdown
4. a decision that the work still needs `design-spec`

## Escalation Rule

Escalate instead of over-solving:

- use `design-spec` when the solution is not yet clear enough to split confidently
- hand off to `implement-feature` when the breakdown is clear enough to execute

## Style Rules

Always:

- keep the breakdown compact
- name tasks clearly
- make completion criteria explicit
- show only meaningful dependencies
- optimize for clean execution flow

Avoid long prose, technical redesign, and fake granularity.
