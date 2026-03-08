# Cleaning Rules

This document defines the rules used by the CleaningService.

The purpose of the cleaning stage is **not to transform the musical content** but to remove obvious noise while preserving all information that may be relevant for musical analysis or conversion.

The cleaning process must be **conservative**.

If a rule risks altering musical alignment or removing potentially useful information, the rule must NOT be applied.

---

# Core Principle

Chord sheets often rely on **monospace alignment** between chords and lyrics.

Example:

Am        G
Hello darkness my old friend

The spaces between chords are meaningful because they indicate the syllable alignment in the lyric line below.

For this reason:

- the cleaner must **never modify internal spacing**
- the cleaner must **never reformat chord lines**
- the cleaner must **never collapse spaces inside lines**

The only safe transformations are those that remove **non-musical noise** or normalize structural formatting.

---

# Information That Must Be Preserved

The following information must always be preserved because it may be useful during conversion or analysis.

Capo information:

Capo 2

Tuning information:

Tuning: DADGAD

Key indications:

Key: Am

Section labels:

Verse
Chorus
Bridge
Intro
Outro

Chord alignment blocks:

Am      G
Hello darkness my old friend

Inline chord notation:

[Am]Hello darkness

URLs or source references:

https://tabs.ultimate-guitar.com/

These may later become metadata such as `source`.

---

# Allowed Cleaning Operations

The cleaner may apply the following operations.

## 1 Remove Known Website Noise

Lines that are clearly website boilerplate may be removed.

Examples:

Ultimate Guitar
Chordify
Report bad tab
Submit corrections
Add to favorites

The cleaner should only remove lines that clearly match known patterns.

If a line may contain musical information, it must not be removed.

---

## 2 Remove Visual Separators

Some chord sheets contain visual separators used for formatting.

Examples:

-----
=====
*****

If a line contains only repeated separator characters, it may be removed.

---

## 3 Remove HTML Artifacts

If the text contains HTML fragments, these may be removed.

Examples:

<div>
<br>
<span>

---

## 4 Remove Invisible Unicode Characters

Some copied texts contain invisible characters.

Examples include:

zero width space
non-breaking space artifacts

These characters may be removed if they do not affect visible alignment.

---

## 5 Normalize Line Endings

Line endings may be normalized to standard newline format.

This operation must not change the number of spaces in any line.

---

## 6 Trim Leading and Trailing Empty Blocks

Excess empty lines at the beginning or end of the text may be removed.

Internal spacing between lines must remain untouched.

---

# Operations That Are Explicitly Forbidden

The cleaner must never perform the following operations.

## Do Not Collapse Spaces Inside Lines

Example:

Am      G

must NOT become:

Am G

This would destroy chord alignment.

---

## Do Not Reformat Chord Lines

Example:

Am      G
Hello darkness

must remain exactly as it is.

---

## Do Not Merge Lines

Chord sheets often depend on line structure.

Lines must never be merged or rearranged.

---

## Do Not Remove Musical Metadata

The following lines must always be preserved:

Capo
Tuning
Key
Instrument notes
Section labels

---

# Examples

## Example 1

INPUT

Ultimate Guitar

Am      G
Hello darkness my old friend


OUTPUT

Am      G
Hello darkness my old friend

---

## Example 2

INPUT

<div>
Capo 2

Am      G
Hello darkness


OUTPUT

Capo 2

Am      G
Hello darkness

---

## Example 3

INPUT

https://tabs.ultimate-guitar.com

Am      G
Hello darkness


OUTPUT

https://tabs.ultimate-guitar.com

Am      G
Hello darkness

---

# Implementation Notes

CleaningService must prioritize **information preservation** over aggressive cleaning.

LLM-based stages later in the pipeline (ConversionService and AnalysisService) are capable of interpreting noisy input.

Therefore, the cleaner should focus only on removing obvious non-musical artifacts while preserving the original musical structure.