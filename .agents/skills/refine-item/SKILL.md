---
name: refine-item
description: Clarify already captured items in this repository workflow by removing meaningful ambiguity, tightening scope, surfacing edge cases, exposing important assumptions, and proposing simplifications before planning or technical design. Use when Codex receives a structured item that is still too fuzzy for roadmap placement, implementation design, or confident follow-up.
---

# Refine Item

Use this skill to turn a captured item into something clearer, more actionable, and easier to route through the workflow.

The goal is not to design the implementation. The goal is to make the item precise enough that the next step becomes obvious or at least much safer.

## Core Rules

When using this skill:

- work from an already captured or documented item
- focus on ambiguity that materially affects meaning, scope, or follow-up
- clarify what the item is really asking for
- identify relevant edge cases
- expose meaningful assumptions
- propose simplifications when they reduce unnecessary complexity
- end with a clear `next_step`

Do not refine for the sake of sounding more complete. Refine only what matters.

## What This Skill May Do

This skill may:

- clarify scope
- separate included vs excluded behavior
- resolve wording that hides multiple interpretations
- expose edge cases worth considering early
- reveal hidden assumptions
- simplify a request before it reaches planning or design
- update documentation when the refined definition materially changes an already tracked item and the user approves it

Do not:

- capture raw notes from scratch
- perform roadmap prioritization
- decide final roadmap placement
- design technical architecture or implementation details
- break the item into implementation tasks

If the item is still too raw, route it back to `capture-item` instead of pretending it is ready.

## Input Expectations

Prefer inputs such as:

- a structured item from `capture-item`
- an existing roadmap item that needs clarification
- a tracked bug, improvement, or feature with unresolved wording
- a question such as:
  - what exactly does this item mean
  - what should be included or excluded
  - what edge cases matter here
  - can this be simplified before planning

## Output Format

Use this structure:

```md
refined_item:
  type: feature | bug | improvement | idea | question
  title: <clear title>

clarified_scope:
- what is included
- what is not included

resolved_ambiguities:
- ambiguity -> clarification

edge_cases:
- important edge case
- important edge case

simplifications:
- proposed simplification if useful

assumptions:
- only meaningful assumptions that affect the item definition

open_points:
- only if something still blocks certainty

next_step:
- close | plan-version | design-spec | backlog
```

## Refinement Standards

Prioritize clarifying:

- scope boundaries
- meaning that could be interpreted in more than one way
- whether the item is user-facing, technical, workflow-related, or mixed
- whether the item is large or narrow
- whether a simpler version would be better now

Do not bloat the item with speculative detail.

## Edge Case Rule

Include edge cases only when they materially affect:

- scope
- behavior expectations
- future planning
- implementation risk

Do not list generic or low-value edge cases just to make the output look thorough.

## Simplification Rule

When a request can be made smaller, clearer, or safer without losing its real value, propose that simplification explicitly.

Prefer:

- a narrower useful item
- a clearer first iteration
- a cleaner definition with fewer moving parts

Over:

- broad vague ambition
- hidden complexity
- premature completeness

## Documentation Rule

This skill is conversation-first by default.

It may update tracked documentation only when:

- the item already exists in docs
- the refinement materially changes its meaning or scope
- the user approves the update

Typical destinations may include:

- `docs/roadmap.md` when the item wording or scope should be corrected
- `docs/dev-notes.md` only when the refinement reveals a stable decision rule or project-level assumption worth recording

Do not write to documentation by default when the item is still moving immediately into another skill.

## Valid Outcomes

Return one of these:

1. a clearly refined item
2. a refined item plus a recommended simplification
3. a decision that the item is still too raw and should go back to `capture-item`
4. an approved documentation update to reflect the refined definition

## Escalation Rule

Escalate instead of over-solving:

- use `capture-item` when the input is still chaotic or mixed
- use `plan-version` when the item is already clear enough for roadmap placement
- use `design-spec` when the item is clear enough for implementation design

## Style Rules

Always:

- keep the refinement compact
- make ambiguity resolution explicit
- separate scope from implementation thinking
- preserve uncertainty where it is real
- optimize for a better next decision, not for verbosity

Avoid long prose, technical design, and fake precision.
