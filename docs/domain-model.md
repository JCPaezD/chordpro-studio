# Domain Model

This document describes the current internal data model used by the application.

The internal model is independent from the ChordPro storage format, even though `.cho` is the canonical persisted format for this phase.

---

## Core Entities

Current domain entities:

- `Song`
- `SongMetadata`
- `SongSource`
- `SongSection`
- `SongLine`
- `SongSegment`
- `Songbook`
- `SongbookEntry`

---

## Song

Current runtime shape:

- `id?`
- `metadata`
- `source?`
- `sections`

Notes:

- the current code does not store pipeline intermediates such as `cleanText` or `chordProText` on the `Song` itself
- the active `.cho` text and file path are tracked separately in the shared `WorkspaceDocument`

---

## SongMetadata

Current fields:

- `title?`
- `artist?`
- `album?`
- `year?`
- `subtitle?`

Metadata is optional because conversion and parsing can succeed with partial song information.

---

## SongSource

Current fields:

- `kind`
- `originalInput?`
- `cleanedInput?`
- `originalFormat?`

Current `SongSourceKind` values:

- `manual`
- `paste`
- `file`
- `scrape`
- `ai`

`originalFormat` values:

- `raw`
- `chordpro`

---

## SongSection

Current fields:

- `type`
- `label?`
- `lines`

Current section types:

- `intro`
- `verse`
- `chorus`
- `bridge`
- `pre-chorus`
- `instrumental`
- `solo`
- `outro`
- `custom`

---

## SongLine

Current fields:

- `lyrics`
- `chords`
- `segments?`

Notes:

- `lyrics` and `chords` remain part of the current runtime interface
- `segments` is optional and is used by the parser/rendering-oriented flow

This means the current code is still in a transitional state between simpler line models and a fully segment-driven model.

---

## SongSegment

Current fields:

- `lyrics`
- `chord?`

Example:

`[Am]Hello darkness my [G]old friend`

can be represented as:

- `SongSegment { chord: "Am", lyrics: "Hello darkness my " }`
- `SongSegment { chord: "G", lyrics: "old friend" }`

---

## Songbook

A songbook represents a selected folder of `.cho` files.

Current fields:

- `path`
- `songs`

### SongbookEntry

Current fields:

- `filePath`
- `displayTitle`

`displayTitle` is derived from parsed song content, not stored inside the file as a separate index.

---

## WorkspaceDocument

`WorkspaceDocument` is not part of the domain folder, but it is part of the active application model and is important for understanding current behavior.

Current fields:

- `filePath`
- `fileName`
- `chordProText`
- parsed `song`
- `dirty`

Responsibilities:

- represent the currently open song
- track unsaved changes
- keep the editable `.cho` source separate from persisted storage

---

## ChordPro Integration

Current persistence and parsing flow:

`.cho`
-> filesystem adapter
-> `ChordProParser`
-> internal `Song`

Current conversion flow:

Raw input
-> cleaning
-> LLM conversion
-> ChordPro validation
-> `ChordProParser`
-> internal `Song`

This means `.cho` is both:

- the canonical persisted format
- the bridge format used before rebuilding the internal `Song`

---

## Design Notes

- The long-term design still favors structured internal models over treating ChordPro as the only source of truth in memory.
- In the current implementation, some interfaces remain pragmatic rather than fully normalized.
- Documentation should track the runtime types as they actually exist, even when future refinements are expected.
