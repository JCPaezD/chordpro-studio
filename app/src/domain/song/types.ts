export type SongId = string;

export type SongSourceKind = "manual" | "paste" | "file" | "scrape" | "ai";

export type SectionType =
  | "intro"
  | "verse"
  | "chorus"
  | "bridge"
  | "pre-chorus"
  | "instrumental"
  | "solo"
  | "outro"
  | "custom";
