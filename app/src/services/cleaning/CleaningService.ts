const WEBSITE_BOILERPLATE_PATTERNS: RegExp[] = [
  /^ultimate\s*guitar$/i,
  /^chordify$/i,
  /^report\s+bad\s+tab$/i,
  /^submit\s+corrections?$/i,
  /^add\s+to\s+favorites?$/i
];

const SEPARATOR_ONLY_LINE = /^[\-=*]{3,}$/;

// Zero-width / formatting characters that are safe to strip.
const INVISIBLE_UNICODE = /[\u200B-\u200D\u2060\uFEFF]/g;

// Conservative HTML tag removal. It removes tags, not visible text.
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;

export class CleaningService {
  clean(rawText: string): string {
    const normalizedText = rawText.replace(/\r\n?/g, "\n");
    const lines = normalizedText.split("\n");
    const cleanedLines: string[] = [];

    for (const line of lines) {
      const withoutInvisible = line
        .replace(INVISIBLE_UNICODE, "")
        // Normalize non-breaking spaces without collapsing spacing.
        .replace(/\u00A0/g, " ");

      const withoutHtml = withoutInvisible.replace(HTML_TAG, "");
      const trimmedForChecks = withoutHtml.trim();

      if (this.isBoilerplate(trimmedForChecks)) {
        continue;
      }

      if (SEPARATOR_ONLY_LINE.test(trimmedForChecks)) {
        continue;
      }

      cleanedLines.push(withoutHtml);
    }

    // Trim empty blocks only at start/end; keep internal line structure intact.
    let start = 0;
    while (start < cleanedLines.length && cleanedLines[start].trim() === "") {
      start += 1;
    }

    let end = cleanedLines.length - 1;
    while (end >= start && cleanedLines[end].trim() === "") {
      end -= 1;
    }

    if (start > end) {
      return "";
    }

    return cleanedLines.slice(start, end + 1).join("\n");
  }

  private isBoilerplate(trimmedLine: string): boolean {
    if (!trimmedLine) {
      return false;
    }

    // URLs must be preserved for future source metadata extraction.
    if (/^https?:\/\//i.test(trimmedLine)) {
      return false;
    }

    return WEBSITE_BOILERPLATE_PATTERNS.some((pattern) =>
      pattern.test(trimmedLine)
    );
  }
}
