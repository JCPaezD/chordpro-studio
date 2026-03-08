# MVP Specification - mvp.md

## Goal

The goal of the MVP is to create a functional desktop application capable of transforming raw chord sheets into structured songbook entries.

The MVP focuses on validating the core workflow of the product.

---

## User Workflow

The expected user workflow is:

Paste song  
↓  
Clean text  
↓  
Convert to ChordPro  
↓  
Preview  
↓  
Adjust preferences  
↓  
Export PDF  
↓  
Save

The system should support iterative adjustments between preview and preferences.

---

## Core Features

### Song Input

The user can paste a chord sheet containing lyrics and chords.

Optional metadata fields:

- title
- artist
- album
- year

---

### Text Cleaning

An AI-assisted step cleans the pasted text.

The cleaning process may include:

- removing extra characters
- normalizing chord notation
- improving formatting
- removing duplicated whitespace

The cleaned result is visible to the user before conversion.

---

### ChordPro Conversion

The cleaned text is processed using an LLM prompt that converts the song into ChordPro format.

The conversion step generates:

- a ChordPro representation
- an internal Song model

---

### Preview

The preview displays the structured song in a readable format.

The preview must support:

- adjustable font size
- column layout
- real-time updates when preferences change

The preview does not expose the raw `.cho` file.

---

### Preferences

Basic user preferences influence layout and formatting.

Example preferences:

- maximum columns
- repetition compaction
- chord notation

Preferences are stored locally.

---

### Export

Songs can be exported as PDF using the ChordPro CLI.

Export flow:

ChordPro → ChordPro CLI → PDF

The export uses configurable style files.

---

## Data Model

The application uses an internal song representation.

Example structure:

Song  
- metadata  
- sections  

Section  
- type  
- lines  

Line  
- chords  
- lyrics

ChordPro is used as an intermediate format.

---

## Out of Scope

The following features are not included in the MVP:

- complex scraping
- AI preference learning
- advanced chord analysis
- cloud synchronization
- mobile support
- setlist management

These features may be added in later phases.

---

## Success Criteria

The MVP is successful if a user can:

1. paste a chord sheet
2. convert it automatically
3. preview the result
4. export a correct PDF
5. save the song

The MVP should already improve the manual workflow used today.