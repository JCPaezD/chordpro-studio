import assert from "node:assert/strict";
import test from "node:test";

import { deriveDisplayTitle, buildSongDisplayTitle } from "../src/domain/song/deriveDisplayTitle.ts";
import { normalizeMetadata } from "../src/domain/song/normalizeMetadata.ts";
import { ChordProOutputValidator, ChordProValidationError } from "../src/domain/validation/ChordProOutputValidator.ts";
import { CleaningService } from "../src/services/cleaning/CleaningService.ts";
import { ChordProParser } from "../src/services/parser/ChordProParser.ts";

test("ChordProParser recognizes comment sections and plain-text headers", () => {
  const parser = new ChordProParser();
  const song = parser.parse(`{title: Demo}
{artist: Test Artist}
{comment: Chorus}
[C]Sing it loud

Pre-Chorus:
[F]Step aside
`);

  assert.equal(song.metadata.title, "Demo");
  assert.equal(song.metadata.artist, "Test Artist");
  assert.equal(song.sections.length, 2);
  assert.equal(song.sections[0]?.type, "chorus");
  assert.equal(song.sections[0]?.label, "Chorus");
  assert.equal(song.sections[1]?.type, "pre-chorus");
});

test("CleaningService removes boilerplate and separators while preserving useful text", () => {
  const service = new CleaningService();
  const cleaned = service.clean(`\uFEFFUltimate Guitar
<div>Actual\u00A0text</div>
https://example.com/source
---
Report bad tab
`);

  assert.equal(cleaned, "Actual text\nhttps://example.com/source");
});

test("deriveDisplayTitle skips directives, chord-only lines, and tab blocks", () => {
  const parser = new ChordProParser();
  const input = `{artist: Smoke Artist}
{comment: Intro}
[C] [G]
{start_of_tab}
E|--0--|
{end_of_tab}

[F]Late smoke line
`;
  const song = parser.parse(input);

  assert.equal(deriveDisplayTitle(input, song.metadata ?? {}, "fallback-demo.cho"), "Late smoke line");
  assert.equal(buildSongDisplayTitle(input, song.metadata ?? {}, "fallback-demo.cho"), "Late smoke line - Smoke Artist");
});

test("normalizeMetadata trims, collapses whitespace, and title-cases values", () => {
  const normalized = normalizeMetadata({
    title: "  hELLo   woRLD  ",
    artist: "   "
  });

  assert.deepEqual(normalized, {
    title: "Hello World",
    artist: ""
  });
});

test("ChordProOutputValidator rejects explanatory wrappers and accepts lyric-only output", () => {
  assert.doesNotThrow(() => {
    ChordProOutputValidator.validate("Hello world");
  });

  assert.throws(
    () => {
      ChordProOutputValidator.validate("Here is the converted song\n[C]Hello");
    },
    (error: unknown) => {
      assert.ok(error instanceof ChordProValidationError);
      assert.equal(error.details?.reason, "explanatory_text_detected");
      return true;
    }
  );
});
