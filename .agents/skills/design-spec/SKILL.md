---
name: design-spec
description: Turn a refined item into a concise implementation-ready design spec for this repository workflow. Use when Codex needs to clarify the exact goal, confirm scope, define the technical approach, surface key rules and edge cases, and prepare a feature, fix, or improvement for implement-feature without jumping into code too early.
---

# Design Spec

Use this skill to turn a clear item into a concise design spec that is ready to feed `implement-feature`.

The goal is not to create heavy documentation. The goal is to reduce ambiguity before implementation, confirm the intended behavior, and define a practical design that fits the real repository.

## Core Rules

When using this skill:

- work from an already refined or otherwise clear item
- confirm the exact goal before fixing the design
- define scope explicitly
- identify the affected areas of the repository
- state key design decisions clearly
- surface important rules, constraints, and invariants
- identify relevant risks and edge cases
- produce a practical implementation plan
- prefer the simplest design that is sufficient and coherent with the repository

Do not confuse design with implementation. Stop before code changes.

## What This Skill May Do

This skill may:

- clarify the final intended behavior before implementation
- propose and compare small design options when needed
- define a minimal viable design
- identify affected components, services, documents, or flows
- state behavioral rules and restrictions
- describe implementation steps at a high enough level to guide execution
- update project documentation when a stable design decision should be recorded and the user approves it

Do not:

- capture raw notes
- perform early-stage refinement that belongs to `refine-item`
- decide roadmap placement
- break the work into session-sized implementation tasks
- write code
- diagnose runtime bugs

If the item is still too ambiguous for design, route it back to `refine-item`.

## Conversation Rule

This skill is conversation-heavy by design.

If a design-relevant ambiguity would materially change scope, behavior, or implementation shape:

- stop
- surface the ambiguity clearly
- propose the meaningful options when helpful
- resolve the point before finalizing the spec

Do not pretend the design is settled when it is not.

## Input Expectations

Prefer inputs such as:

- a refined item
- a planned item selected for the next block or version
- an already discussed feature, fix, or improvement that is ready for design
- a question such as:
  - how should this be implemented in the current repo
  - what exactly should be included
  - what is the simplest valid design
  - what risks or edge cases should be accounted for

## Output Format

Use this structure:

Return the main workflow result in normal markdown that reflows naturally in the UI.
Do not wrap the main human-readable output in fenced code blocks unless literal formatting must be preserved.

---

# Feature: <name>

## Context
- why this exists now

## Exact Goal
- what must be achieved

## Scope
- includes
- does not include

## Technical Design
- affected components or areas
- data flow
- key decisions

## Contracts / Rules
- invariants
- restrictions
- behavioral rules

## Risks / Edge Cases
- important risks
- important edge cases

## Implementation Plan
1. ordered step
2. ordered step
3. ordered step

## Documentation Impact
- roadmap
- dev-notes
- architecture
- none

---

## Design Standards

Prioritize:

- clarity over completeness
- repository coherence over abstract elegance
- minimal viable design over speculative extensibility
- explicit boundaries over implicit assumptions
- practical implementation guidance over theoretical architecture

Do not over-design.

## Minimal Viable Design Rule

When more than one design is possible, prefer the option that is:

- simpler
- consistent with the existing repo
- sufficient for the actual goal
- less risky to implement and validate

Do not expand scope just because a more general design sounds cleaner.

## Documentation Rule

This skill is conversation-first by default.

Do not create standalone spec artifacts by default.

It may update tracked documentation only when:

- the design discussion establishes a stable decision worth preserving
- that decision materially affects architecture, workflow, or long-term behavior
- the user approves the update

Typical destinations may include:

- `docs/dev-notes.md` for stable assumptions or decision rules
- `docs/architecture.md` when the design changes architectural understanding
- `docs/roadmap.md` only if the item description or scope must be adjusted to match the approved design

## Valid Outcomes

Return one of these:

1. a clear design spec ready for `implement-feature`
2. a design spec with one or two explicit open decisions that must be resolved first
3. a decision that the item still needs `refine-item`
4. an approved documentation update that records a stable design decision

## Escalation Rule

Escalate instead of over-solving:

- use `refine-item` when the item is not yet clear enough for design
- use `breakdown-feature` when the approved design is too large and should be split before implementation
- hand off to `implement-feature` when the spec is clear enough to execute

## Style Rules

Always:

- keep the spec compact
- make scope boundaries explicit
- write decisions clearly
- distinguish current decisions from open questions
- optimize for implementation readiness, not document polish

Avoid long prose, exhaustive theory, and unnecessary formalism.
