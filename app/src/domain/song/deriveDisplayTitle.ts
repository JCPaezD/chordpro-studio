import type { SongMetadata } from "./metadata";

const CHORD_TOKEN_PATTERN = /\[[^\]\r\n]+\]/g;
const DIRECTIVE_LINE_PATTERN = /^\s*\{[^}\r\n]+\}\s*$/;
const TITLE_DIRECTIVE_PATTERN = /^\s*\{title:\s*(.*?)\s*\}\s*$/i;
const START_OF_TAB_PATTERN = /^\s*\{start_of_tab\}\s*$/i;
const END_OF_TAB_PATTERN = /^\s*\{end_of_tab\}\s*$/i;
const FILE_EXTENSION_PATTERN = /\.[^.\\/]+$/;
const LETTER_PATTERN = /\p{L}/u;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripExtension(fileName: string): string {
  return normalizeWhitespace(fileName.replace(FILE_EXTENSION_PATTERN, ""));
}

function containsLetter(value: string): boolean {
  return LETTER_PATTERN.test(value);
}

function cleanLyricCandidate(line: string): string {
  return normalizeWhitespace(line.replace(CHORD_TOKEN_PATTERN, " "));
}

function getExplicitTitle(metadata: SongMetadata, songText: string): string {
  const metadataTitle = metadata.title?.trim();
  if (metadataTitle) {
    return metadataTitle;
  }

  const titleMatch = songText.match(TITLE_DIRECTIVE_PATTERN);
  return titleMatch?.[1]?.trim() || "";
}

export function deriveDisplayTitle(songText: string, metadata: SongMetadata, fileName: string): string {
  const explicitTitle = getExplicitTitle(metadata, songText);
  if (explicitTitle) {
    return explicitTitle;
  }

  let inTabBlock = false;

  for (const rawLine of songText.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }

    if (START_OF_TAB_PATTERN.test(trimmed)) {
      inTabBlock = true;
      continue;
    }

    if (END_OF_TAB_PATTERN.test(trimmed)) {
      inTabBlock = false;
      continue;
    }

    if (inTabBlock || DIRECTIVE_LINE_PATTERN.test(trimmed)) {
      continue;
    }

    const lyricCandidate = cleanLyricCandidate(rawLine);
    if (!lyricCandidate || !containsLetter(lyricCandidate)) {
      continue;
    }

    return lyricCandidate;
  }

  const artist = metadata.artist?.trim();
  if (artist) {
    return artist;
  }

  const fallbackName = stripExtension(fileName);
  return fallbackName || "Untitled";
}

export function buildSongDisplayTitle(songText: string, metadata: SongMetadata, fileName: string): string {
  const title = deriveDisplayTitle(songText, metadata, fileName);
  const artist = metadata.artist?.trim();

  if (artist && artist !== title) {
    return `${title} - ${artist}`;
  }

  return title;
}
