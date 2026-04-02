---
name: release-workflow
description: Prepare a local build or publish a public versioned release for this ChordPro Studio repository. Use when the user wants to close a version, prepare release notes, run pre-release validation, bump synchronized versions, build Tauri artifacts, organize `releases/vX.Y.Z/`, or publish a GitHub Release. This skill is project-specific and should be used for both local rebuilds and public releases.
---

# Release Workflow

## Overview

Use this skill to run the full release flow for this repository with the project's real conventions:

- decide whether the target is a local build or a public release
- validate the version before publishing
- prepare concise release notes from real changes only
- sync project version metadata
- build Tauri artifacts
- organize human-facing artifacts under `releases/vX.Y.Z/`
- stop for required human checks before publishing

Keep the workflow sequential. Do not skip the human checkpoints.

## Workflow

### 1. Confirm scope and release type

Start by checking what actually belongs to the version:

- review commits since the last release tag
- cross-check `docs/roadmap.md`
- cross-check `docs/dev-notes.md`

Then explicitly decide the release character with the user:

- `local build` for dev/local testing only
- `public release` for repo publication and GitHub Releases

Recommend one of the two based on context, then stop for confirmation before continuing.

### 2. Run pre-release automatic checks and prepare the checklist

Before giving the user a manual checklist, run the normal automated checks when applicable:

- `npm run smoke`
- `cargo check` in `src-tauri/`
- `npm run build` in `app/`

Then prepare a short manual checklist focused on:

- fixes included in the target version
- quick regression scan of the app
- any area that especially benefits from human verification

Deliver the checklist with the automatic checks already marked as done, then stop for manual validation.

### 3. Draft release notes

Write release notes only from real implemented changes.

Rules:

- use commits plus `roadmap` and `dev-notes` as sources
- do not include roadmap items that were not implemented
- do not invent features
- keep patch releases compact
- allow slightly broader notes for larger milestone releases

Store the draft in:

- `.tmp/vX.Y.Z-release-notes.md`

Then stop for human review and approval of the notes.

### 4. Update version metadata and visible documentation

When the version is approved, update synchronized version metadata:

- `package.json`
- `app/package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Allow `src-tauri/Cargo.lock` to update through normal Rust tooling when needed.

In the same phase, review visible release-facing documentation:

- review `README.md` completely, not only the installation artifact numbers
- update installation artifact references to the new version
- adjust any other README content that is no longer accurate for the current release
- when the release includes meaningful visual/UI changes, explicitly review whether the README screenshots are still representative enough or need updating
- review other visible docs only if the version makes them materially outdated

If `README.md` changes, show that documentation update for human review as part of the release flow. Do not silently publish a release with README changes that were never reviewed.

### 5. Run release build

For public releases, run:

- `npm run tauri -- build`

For local builds, use the requested local build path, but keep version metadata synchronized in the same way.

Before continuing, verify that the build actually produced the expected outputs for the chosen target rather than assuming success from the command alone.

### 6. Organize human-facing artifacts

Treat `src-tauri/target/` as transient output.

Copy final artifacts into:

- `releases/vX.Y.Z/`

Expected structure in this project:

- `releases/vX.Y.Z/ChordProStudio-vX.Y.Z/` portable folder
- `releases/vX.Y.Z/ChordProStudio-vX.Y.Z.zip`
- `releases/vX.Y.Z/ChordProStudio-vX.Y.Z.msi`
- `releases/vX.Y.Z/ChordProStudio-vX.Y.Z-setup.exe`
- `releases/vX.Y.Z/release-notes.md`

Before copying, quickly inspect the latest existing release folders to confirm that the expected structure is still current.

The final approved release notes must be copied from `.tmp/` into:

- `releases/vX.Y.Z/release-notes.md`

### 7. Stop for final manual validation

Always stop before publication for human validation of the built artifacts.

Typical checks:

- install or upgrade
- launch the app
- quick general product verification

Do not publish until the user confirms that the built version is good.

### 8. Close the version

For a local build:

- prepare the build/version commit only if requested
- do not create a GitHub Release

For a public release:

- run a small publication preflight first:
  - confirm `gh` is available in the environment
  - if publication tooling is missing or broken, stop instead of pretending the release can be closed
- create the release commit
- push `master`
- create tag `vX.Y.Z`
- push the tag
- create the GitHub Release
- upload the approved release artifacts
- use the approved release notes

Do not publish automatically unless the user explicitly asks for it.

### 9. Final human verification after publication

After publishing a public release, explicitly verify with the user that:

- the GitHub Release page is visible
- notes look correct
- artifacts are attached
- the release is considered closed

If a post-release documentation issue appears, fix it in a separate follow-up commit instead of rebuilding the release unless binaries are actually affected.

## Project-specific rules

- `src-tauri/tauri.conf.json` is the source of truth for app version
- keep the four version files synchronized
- do not track build artifacts in Git
- keep release notes concise and factual
- prefer MSI-to-MSI validation when checking installer upgrade behavior
- keep the release process stoppable at each human review point
