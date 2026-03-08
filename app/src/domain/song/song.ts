export interface SongMetadata {
  title: string;
  artist: string;
  album?: string;
  year?: string;
}

export interface SongLine {
  chords: string[];
  lyrics: string;
}

export interface SongSection {
  type: "verse" | "chorus" | "bridge" | "intro" | "outro";
  lines: SongLine[];
}

export interface Song {
  metadata: SongMetadata;
  sections: SongSection[];
}
