---
name: capture-item
description: Convert raw development notes, mixed feedback, informal bug reports, small doubts, feature ideas, and loosely written change requests into clear structured items for this repository workflow. Use when Codex needs to capture chaotic input, separate mixed points, classify them, suggest the next workflow step, close trivial points, or register approved items in project documentation so they are not lost.
---

# Capture Item

Use this skill to turn messy input into a small number of clear, useful items.

The goal is to avoid losing notes, reduce ambiguity early, and give each point a clear outcome:

- close it
- document it
- refine it
- plan it
- design it later

Keep outputs short, structured, and practical.

## Core Rules

When using this skill:

- identify whether the input contains one item or multiple items
- separate only when there is a real difference in problem, goal, or follow-up
- classify each item clearly
- keep the wording concise and concrete
- preserve important context without copying unnecessary noise
- assign an explicit `next_step`
- avoid premature design or implementation planning

Do not over-structure weak notes into fake precision.

## Allowed Outcomes

This skill may:

- capture a single note as one structured item
- split mixed notes into multiple structured items
- close a trivial point if no further action is needed
- state that nothing worth capturing is present
- propose where the result should be documented
- update approved documentation when the item is already clear enough to archive

Do not:

- perform deep analysis
- resolve meaningful scope ambiguity
- design technical implementation
- break work into implementation tasks
- plan a full version or milestone
- create fake certainty around unclear notes

If the point needs deeper clarification, hand it off through `next_step` instead of forcing a final answer.

## Output Modes

Return one of these:

1. `structured item`
2. `multiple structured items`
3. `closed small point`
4. `nothing worth capturing`

## Item Format

Use this format for structured items:

Return the main workflow result in normal markdown that reflows naturally in the UI.
Do not wrap the main human-readable output in fenced code blocks unless literal formatting must be preserved.

---

**Type**
- feature | bug | improvement | idea | question

**Title**
- short and clear

**Description**
- context
- observed problem or idea

**Impact**
- user | technical | workflow | mixed

**Notes**
- additional observations

**Next Step**
- close | refine-item | plan-version | design-spec | backlog | document-now

---

## Classification Guidance

Use these types:

- `feature`: new capability or meaningful new behavior
- `bug`: incorrect, broken, inconsistent, or clearly unintended behavior
- `improvement`: refinement of an existing flow, UX, structure, or behavior
- `idea`: early concept worth keeping without enough clarity yet
- `question`: open doubt, decision point, or uncertainty that should not be lost

Use the simplest accurate type. Do not overthink classification when the next step matters more.

## Trivial Point Rule

Close the point directly when all of these are true:

- it is small and self-contained
- it does not need deeper design
- it does not create meaningful follow-up work
- it does not need long-term tracking

In that case, return a short closure instead of inflating backlog or docs.

## Documentation Rule

Do not let non-trivial notes disappear.

If the result is clear enough to preserve and the user approves documenting it, update the relevant project documentation instead of leaving it only in conversation.

Typical destinations may include:

- `docs/roadmap.md` for pending work, backlog, planned blocks, or future work
- `docs/dev-notes.md` for stable workflow or decision-level notes that should remain visible later

`backlog` is a destination, not a separate skill. Use it when the item should be preserved as tracked future work without immediate refinement or design.

Do not write to documentation by default when the item is still vague or is immediately moving into another skill in the same conversation.

When not documenting yet, still leave an explicit `next_step`.

## Escalation Rule

Escalate instead of over-solving:

- use `refine-item` when the item is captured but still ambiguous
- use `plan-version` when the item must be grouped or prioritized within a work block
- use `design-spec` when the item is already decided and needs implementation design
- route to `backlog` when the item should be documented and preserved for later without immediate follow-up

## Style Rules

Always:

- prefer short titles
- keep descriptions high-signal
- remove repetition
- preserve important nuance
- state uncertainty plainly when it exists
- end with a clear outcome

Avoid long prose, speculative design, and unnecessary detail.
