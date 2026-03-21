import type { SongMetadata } from "./metadata";

function normalizeMetadataValue(value?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }

  return trimmed
    .split(" ")
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase())
    .join(" ");
}

export function normalizeMetadata(metadata: Pick<SongMetadata, "title" | "artist">): Pick<SongMetadata, "title" | "artist"> {
  return {
    title: normalizeMetadataValue(metadata.title),
    artist: normalizeMetadataValue(metadata.artist)
  };
}
