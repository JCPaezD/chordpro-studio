# Prompt Design Notes

This document stores design decisions and historical context for LLM prompts used in the project.

Its purpose is to avoid losing prompt design ideas when prompts are simplified or responsibilities are moved to other components.

The current prompt used for conversion contains logic that may later belong to other system components, such as:

- requesting missing metadata from the user
- explaining conversion decisions
- providing notes about the generated output
- enforcing metadata validation rules

During early MVP development the pipeline requires a stricter behavior:

Conversion prompts should behave as deterministic transformers.

Input:
song text

Output:
ChordPro only

No explanations or conversational text should be returned.

Future LLM components may include:

- metadata assistant
- cleaning / normalization assistant
- analysis tools for song structure

These ideas should remain documented here even if they are removed from the main conversion prompt.