# Project Instructions

## Shell and command execution

- The shared environment is Windows PowerShell.
- Do not use `&&` as a command separator.
- Prefer running commands in separate steps when order matters.
- Use parallel command execution only for read-only inspection tasks.

## Git safety

- Never run mutating Git commands in parallel.
- Keep `git add`, `git commit`, `git tag`, and `git push` strictly sequential.
- Wait for each Git command to finish before starting the next one.
- Do not create commits or push unless the user explicitly asks for it.

## Validation and closure

- If a change affects UI, UX, layout, dialogs, or interaction flow, stop for human validation before treating the task as closed.
- Do not mark roadmap items as completed or prepare final closure docs before that validation.

## Editing discipline

- Avoid competing writes to the same file or resource.
- Re-read files before critical edits when there is any chance they changed during the task.
- If an editing approach fails repeatedly, stop retrying variants of the same patch and switch to a more deterministic edit strategy.

## Stitch MCP

- Use the repo-local `stitch` MCP server when the user wants UI exploration, redesign ideas, design-system iteration, or visual mockups before implementation.
- Treat Stitch outputs as exploratory design references, not as implementation-ready source of truth.
- When applying ideas from Stitch to the app, adapt them carefully to the existing product constraints and UI coherence instead of copying them blindly.
- For screenshot-driven Stitch work, prefer a two-step flow: use `edit_screens` first to obtain a stable editable screen, then use `generate_variants` on that editable screen for bounded exploration.
- Do not treat `generate_variants` from a raw screenshot as the primary or most reliable path for visual evaluation; validate important outputs in the Stitch web UI.
