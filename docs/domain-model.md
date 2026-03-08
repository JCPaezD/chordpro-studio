# Domain Model

This document describes the core data model used by the application.

The domain model represents songs independently of any external format such as ChordPro.

ChordPro is treated as an intermediate export format rather than the primary internal representation.

---

# Core Entities

The system models songs using the following entities:

Song  
Metadata  
Source  
Section  
Line  
Segment  

---

# Song

Represents a complete song.

Fields:

- id
- metadata
- sections
- sourceText
- cleanText
- chordProText
- preferencesOverride
- tags
- notes
- difficulty
- createdAt
- updatedAt

The song stores intermediate pipeline data so that processing does not need to be repeated.

---

# Metadata

Metadata contains song-level descriptive information.

Fields:

- title
- artist
- album
- year
- key
- tempo
- timeSignature
- source

---

# Source

Optional information about where the chord sheet originated.

Fields:

- type
- url
- retrievedAt

Example source types may include:

- ultimate-guitar
- cifraclub
- manual
- other

---

# Section

Songs are divided into sections.

Fields:

- id
- type
- label
- lines
- repeat

Section types include:

- verse
- chorus
- bridge
- intro
- outro
- solo
- instrumental
- other

---

# Line

A line represents a visual row of lyrics and chords.

Fields:

- segments

---

# Segment

Segments are the smallest unit of rendering.

Each segment contains:

- optional chord
- lyric text

Example:

[Am]Hello darkness my [G]old friend

Is represented as:

Segment(chord="Am", lyric="Hello darkness my ")  
Segment(chord="G", lyric="old friend")

---

# Design Decisions

The system models chord sheets using **segments** rather than separate chord arrays.

This allows:

- exact chord placement
- future transposition
- flexible rendering
- accurate export to ChordPro

Chord values are currently stored as strings.

Chord parsing and structured chord objects may be introduced later.

---

# ChordPro Integration

ChordPro is not used as the primary model.

Instead the flow is:

Raw Text  
↓  
Clean Text  
↓  
ChordPro Text  
↓  
Internal Song Model

ChordPro is later used for PDF export.

## Section Identification

Sections may originate from two sources:

1. Explicit ChordPro section directives.
2. Detected textual section headers in chord sheets.

Examples of textual headers:

Verse  
Chorus  
Bridge  
Intro  
Outro  

When detected, these headers should be mapped to the corresponding SectionType.