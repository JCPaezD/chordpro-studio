import type {
  SectionType,
  Song,
  SongLine,
  SongMetadata,
  SongSection,
  SongSegment
} from "../../domain/song";

const SECTION_START_DIRECTIVES: Record<string, SectionType> = {
  start_of_verse: "verse",
  start_of_chorus: "chorus",
  start_of_bridge: "bridge",
  start_of_intro: "intro",
  start_of_outro: "outro",
  start_of_solo: "solo",
  start_of_instrumental: "instrumental"
};

const SECTION_END_DIRECTIVES = new Set<string>([
  "end_of_verse",
  "end_of_chorus",
  "end_of_bridge",
  "end_of_intro",
  "end_of_outro",
  "end_of_solo",
  "end_of_instrumental"
]);

export class ChordProParser {
  parse(input: string): Song {
    const metadata: SongMetadata = {};
    const sections: SongSection[] = [];

    let currentSection: SongSection | undefined;
    let inDirectiveSection = false;

    const lines = input.replace(/\r\n?/g, "\n").split("\n");

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      const directive = this.parseDirective(trimmed);

      if (directive) {
        const { key, value } = directive;

        if (this.parseMetadataDirective(metadata, key, value)) {
          continue;
        }

        const sectionType = SECTION_START_DIRECTIVES[key];
        if (sectionType) {
          currentSection = this.beginSection(
            sections,
            currentSection,
            sectionType,
            value
          );
          inDirectiveSection = true;
          continue;
        }

        if (SECTION_END_DIRECTIVES.has(key)) {
          currentSection = undefined;
          inDirectiveSection = false;
          continue;
        }

        if (key === "comment" && value) {
          const typeFromComment = this.matchSectionHeader(value) ?? "custom";
          currentSection = this.beginSection(
            sections,
            currentSection,
            typeFromComment,
            value
          );
          continue;
        }

        // Unsupported directives are intentionally ignored.
        continue;
      }

      if (!inDirectiveSection) {
        const headerType = this.matchSectionHeader(trimmed);
        if (headerType) {
          currentSection = this.beginSection(
            sections,
            currentSection,
            headerType,
            trimmed
          );
          continue;
        }
      }

      if (!currentSection) {
        currentSection = this.beginSection(sections, undefined, "verse");
      }

      // Preserve blank lines only inside an existing section.
      if (trimmed.length === 0 && currentSection.lines.length === 0) {
        continue;
      }

      currentSection.lines.push(this.parseLine(rawLine));
    }

    return {
      metadata,
      sections
    };
  }

  private parseDirective(
    line: string
  ): { key: string; value?: string } | undefined {
    const directiveMatch = line.match(/^\{([^}]+)\}$/);
    if (!directiveMatch) {
      return undefined;
    }

    const content = directiveMatch[1].trim();
    const separatorIndex = content.indexOf(":");

    if (separatorIndex === -1) {
      return { key: content.toLowerCase() };
    }

    const key = content.slice(0, separatorIndex).trim().toLowerCase();
    const value = content.slice(separatorIndex + 1).trim();

    return { key, value: value.length > 0 ? value : undefined };
  }

  private parseMetadataDirective(
    metadata: SongMetadata,
    key: string,
    value?: string
  ): boolean {
    if (!value) {
      return false;
    }

    if (key === "title") {
      metadata.title = value;
      return true;
    }

    if (key === "artist") {
      metadata.artist = value;
      return true;
    }

    if (key === "album") {
      metadata.album = value;
      return true;
    }

    if (key === "year") {
      metadata.year = value;
      return true;
    }

    return false;
  }

  private beginSection(
    sections: SongSection[],
    currentSection: SongSection | undefined,
    type: SectionType,
    label?: string
  ): SongSection {
    if (
      currentSection &&
      currentSection.lines.length === 0 &&
      currentSection.label === undefined
    ) {
      currentSection.type = type;
      currentSection.label = label;
      return currentSection;
    }

    const section: SongSection = {
      type,
      label,
      lines: []
    };

    sections.push(section);
    return section;
  }

  private matchSectionHeader(line: string): SectionType | undefined {
    const normalized = line.toLowerCase().replace(/[:\s]+$/g, "").trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized.startsWith("verse")) {
      return "verse";
    }
    if (normalized.startsWith("chorus")) {
      return "chorus";
    }
    if (normalized.startsWith("bridge")) {
      return "bridge";
    }
    if (normalized.startsWith("intro")) {
      return "intro";
    }
    if (normalized.startsWith("outro")) {
      return "outro";
    }
    if (normalized.startsWith("solo")) {
      return "solo";
    }
    if (normalized.startsWith("instrumental")) {
      return "instrumental";
    }
    if (normalized.startsWith("pre-chorus") || normalized.startsWith("prechorus")) {
      return "pre-chorus";
    }

    return undefined;
  }

  private parseLine(line: string): SongLine {
    const segments: SongSegment[] = [];
    const chordPattern = /\[([^\]]+)\]/g;

    let cursor = 0;
    let match: RegExpExecArray | null = chordPattern.exec(line);

    while (match) {
      const lyrics = line.slice(cursor, match.index);
      const chord = match[1].trim();

      if (lyrics.length > 0 || chord.length > 0) {
        segments.push({
          lyrics,
          chord: chord.length > 0 ? chord : undefined
        });
      }

      cursor = match.index + match[0].length;
      match = chordPattern.exec(line);
    }

    const trailingLyrics = line.slice(cursor);
    if (segments.length === 0) {
      segments.push({ lyrics: line });
    } else if (trailingLyrics.length > 0) {
      segments.push({ lyrics: trailingLyrics });
    }

    const chords = segments
      .map((segment) => segment.chord)
      .filter((chord): chord is string => chord !== undefined);
    const lyrics = segments.map((segment) => segment.lyrics).join("");

    return {
      lyrics,
      chords,
      segments
    };
  }
}
