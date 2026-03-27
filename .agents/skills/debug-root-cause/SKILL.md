---
name: debug-root-cause
description: Use this skill when a bug is persistent, unclear, or has resisted initial implementation attempts. This includes repeated failed fixes, inconsistent behavior, UI issues with unclear causes, state mismatches, cache issues, or when the root cause is unknown. Do not use for implementing features or applying fixes. This skill is for diagnosis only.
---

# Debug Root Cause Skill

This skill switches Codex into **diagnostic mode**.

Use it to understand problems, not to fix them.

It must not produce implementation changes unless explicitly requested after the diagnosis.

---

# Purpose

The goal is to:

- identify the real root cause of a problem
- avoid speculative fixes
- avoid iterative patching
- produce a clear, evidence-based explanation

---

# When To Use

Use this skill when:

- a bug persists after reasonable implementation attempts
- multiple fixes have failed or partially worked
- behavior is inconsistent or difficult to explain
- UI does not match expected state
- async, timing, or lifecycle issues are suspected
- cache invalidation or stale data may be involved
- CLI or external process behavior is unclear
- the correct layer of the problem is unknown

Do NOT use when:

- implementing new features
- applying straightforward fixes
- making small, obvious corrections

---

# Core Rules

During this skill:

- do NOT modify code
- do NOT propose speculative fixes
- do NOT iterate on possible solutions
- do NOT expand scope unnecessarily

Focus only on understanding the problem.

---

# Diagnostic Process

Follow this sequence:

## 1. Understand the problem

- restate the issue clearly
- identify expected vs actual behavior
- identify where the mismatch occurs

## 2. Identify involved parts of the system

- relevant components
- composables / services
- state sources
- rendering layers
- external processes (CLI, filesystem, etc.)

Do not explore unrelated parts of the repo.

---

## 3. Trace data and control flow

- how data moves through the system
- where state is created, transformed, and consumed
- where desynchronization may occur

Focus on:

- state vs UI mismatches
- lifecycle timing
- async boundaries
- caching layers

---

## 4. Identify likely root causes

Provide a small set of plausible causes:

- incorrect assumptions
- wrong source of truth
- timing issues
- stale cache usage
- missing invalidation
- UI rendering constraints
- side effects or race conditions

Do not guess broadly. Keep it focused.

---

## 5. Propose validation strategy

If needed, suggest:

- minimal logging points
- state inspection
- ordering verification
- controlled reproduction steps

Diagnostics must be:

- scoped
- temporary
- high-signal

---

## 6. Conclusion

Provide:

- most likely root cause
- why previous attempts failed
- what must be confirmed before fixing

---

# Output Expectations

Return:

- clear explanation of the problem
- involved parts of the system
- root cause hypothesis
- validation plan (if needed)

Do NOT include:

- code changes
- patches
- implementation steps

---

# Relationship With Implement Feature

This skill is complementary to implement-feature:

- implement-feature -> builds and modifies
- debug-root-cause -> investigates and explains

Do not mix both behaviors in the same response.

Once diagnosis is complete:

- either stop and wait for user input
- or explicitly request permission to switch back to implementation
