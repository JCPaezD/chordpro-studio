---
name: plan-version
description: Build, adjust, or reorganize roadmap blocks and working versions from captured or refined items in this repository workflow. Use when Codex needs to decide what belongs in a version or work block, choose roadmap placement, move backlog items, reorder priorities, create macro-slices for an approved version, clarify roadmap structure, or document an approved planning decision in docs/roadmap.md. Skip this skill for already placed small changes that can safely move to design or implementation.
---

# Plan Version

Use this skill to turn a loose set of candidate items into a coherent work block or roadmap adjustment.

`Version` here does not mean only a public release. It may refer to:

- the next real product version
- a patch or stabilization pass
- an internal work block
- a mixed block of UX, fixes, tooling, or cleanup
- a roadmap reorganization decision

Keep the output planning-oriented. Decide what belongs together, what should move, and what should wait.

See `.agents/workflow.md` for the shared workflow map.

## Core Rules

When using this skill:

- plan at block level, not implementation level
- decide what enters now, what moves, and what stays out
- keep the selected scope coherent and manageable
- consider real project context, not abstract product planning only
- explain why included items belong together
- explain why excluded or moved items do not belong where they were
- make the next workflow step explicit
- when a version or work block is already sufficiently decided, prefer recording it in `docs/roadmap.md` before moving into feature-level design work
- when planning a real version or work block, leave enough macro-slicing to guide execution before treating the planning pass as complete
- keep the richer planning narrative in conversation output
- when updating `docs/roadmap.md`, prefer operational roadmap edits over explanatory planning prose

Do not turn planning into technical design.

## Boundary Rule

Use this skill for placement, scope, grouping, and macro-slicing.

For real versions or work blocks, macro-slicing means selected areas or slices, includes/excludes, general order, strong dependencies, and the next step per slice. It does not mean executable implementation tasks.

Use `design-spec` after this skill for selected slices that need behavior or technical design. Use `breakdown-feature` after design when a slice is too large, mixed, or risky for one clean implementation pass.

## What This Skill May Do

This skill may:

- create a new work block or version proposal
- review the current roadmap and adjust priorities
- choose the right roadmap destination for an item
- move items between blocks or backlog sections
- reorder items inside a block when that improves execution order
- create or refresh macro-slices for an already planned version before implementation resumes
- clarify a diffuse or outdated roadmap section
- update `docs/roadmap.md` when the planning decision is approved
- turn an approved version plan into a surgical roadmap update that is ready for execution

Do not:

- capture raw notes from scratch
- deeply refine ambiguous items
- design technical implementation
- break a feature into executable implementation tasks
- perform generic documentation cleanup with no planning decision behind it

If planning is blocked by item ambiguity, stop and route the item to `refine-item` instead of forcing a roadmap decision.

## Input Expectations

Prefer inputs such as:

- captured items
- refined items
- the relevant current roadmap section
- a shortlist of candidate items for the next block
- a planning question such as:
  - what should go into the next version
  - where should this item live in the roadmap
  - should these items move between blocks
  - does the current backlog structure still make sense

This skill may work from partial context, but it should say so when the plan depends on missing clarity.

## Output Format

Use this structure when proposing a block or roadmap adjustment:

Return the main workflow result in normal markdown that reflows naturally in the UI.
Do not wrap the main human-readable output in fenced code blocks unless literal formatting must be preserved.
This structure is for conversation output, not for direct roadmap transcription.

---

**Version**
- <name or working label>

**Goal**
- what this block or roadmap adjustment is trying to achieve

**Includes**
1. <item>
2. <item>
3. <item>

**Moves**
- <item> -> from <block> to <block>
- <item> -> reorder within <block>

**Excludes**
- <item> -> why not now
- <item> -> why not now

**Order**
1. <item or block>
2. <item or block>
3. <item or block>

**Macro-Slices**
- <slice> -> next step: design-spec | breakdown-feature | implement-feature | backlog
- <slice> -> next step: design-spec | breakdown-feature | implement-feature | backlog

**Justification**
- why each included or moved item belongs there now
- why this combination makes sense now

**Risks**
- conflicting scope
- unresolved ambiguity
- technical uncertainty
- validation cost
- roadmap sprawl

**Dependencies**
- explicit dependencies if they matter
- otherwise state none

**Open Questions**
- only if they affect the plan materially

**Next Step**
- refine-item | design-spec | breakdown-feature | document-now

---

## Selection Criteria

Favor plans that are:

- coherent
- realistic to execute
- well justified
- not inflated
- useful for the current project moment

Consider:

- real user friction
- value to product or workflow
- implementation cost
- validation cost
- documentation impact
- item maturity
- dependencies
- the correct planning horizon:
  - near-term
  - patch or stabilization
  - later version
  - future or long-term
- current learning and execution capacity when it materially affects what is sensible to tackle now

## Roadmap Placement Rule

This skill owns the final decision about where an item should live in the roadmap.

Earlier skills may suggest likely destinations, but `plan-version` decides whether the item belongs in:

- the current near-term backlog
- a patch or stabilization block
- a later version
- a future section
- another existing roadmap block

Make that decision from the global planning context, not from the item alone.

## Documentation Rule

This skill may write to `docs/roadmap.md` when the user approves the planning decision.

Typical updates include:

- adding items to a block
- creating a new planned block
- moving items between blocks
- reordering priorities
- clarifying block boundaries

Keep the richer planning summary in conversation.

When updating `docs/roadmap.md`, prefer an operational representation of the approved plan:

- create or adjust the target roadmap block
- move selected items into that block
- reorder items when needed
- preserve existing item wording unless planning decisions changed scope, meaning, order, or clarity enough to justify rewriting
- rewrite item text only when the planning conversation materially changed the intended work
- avoid copying `Goal`, `Justification`, `Risks`, or other explanatory planning narrative into roadmap entries unless the roadmap truly needs that information
- aim for a result that reads like a prepared work block, not like a planning report

When the conversation has already converged on a clear version or work block, prefer `document-now` as the next step before `design-spec`.
Use `design-spec` after that for the main selected features or technical blocks inside the approved version, not as a substitute for recording the version decision itself.

When a version is already documented and implementation is resuming, use this skill only if the roadmap block lacks enough macro-slicing or execution order. If the existing block is already clear enough, start with the selected slice's `design-spec`, `breakdown-feature`, or `implement-feature`.

Do not update `docs/dev-notes.md` unless the planning discussion itself establishes a stable process or decision rule worth recording.

## Valid Outcomes

Return one of these:

1. a clear block or version plan
2. a roadmap reorganization proposal
3. two planning options with a real tradeoff
4. a decision that planning is premature because items are still unclear
5. an approved roadmap update

## Escalation Rule

Escalate instead of over-solving:

- use `refine-item` when an item is not clear enough to place confidently
- use `design-spec` when a selected feature or technical block inside an approved version needs implementation design
- use `breakdown-feature` when a selected item is too large and must be split before implementation
- use `implement-feature` when a selected item is already clear, placed, and small enough for direct execution

## Style Rules

Always:

- keep the plan compact
- state inclusion and exclusion reasons clearly
- make movement between blocks explicit
- preserve flexibility when uncertainty is real
- optimize for practical decision-making, not perfect planning language

Avoid long prose, technical design, and roadmap churn without justification.
