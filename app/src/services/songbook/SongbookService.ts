import type { Song } from "../../domain/song";
import type { Songbook } from "../../domain/songbook";
import { SongRepository } from "../../adapters/filesystem/SongRepository";
import { ChordProParser } from "../parser/ChordProParser";

export type LoadedSongFile = {
  filePath: string;
  fileName: string;
  chordProText: string;
  song: Song;
};

function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? filePath;
}

function truncatePreview(text: string, maxLength = 40): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized || "Untitled song";
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function buildFallbackTitle(song: Song): string {
  const lyricLines: string[] = [];

  for (const section of song.sections) {
    for (const line of section.lines) {
      const lyric = line.segments
        .map((segment) => segment.lyric ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();

      if (!lyric) {
        continue;
      }

      lyricLines.push(lyric);

      if (lyricLines.join(" ").length >= 40) {
        return truncatePreview(lyricLines.join(" "));
      }
    }
  }

  return truncatePreview(lyricLines.join(" "));
}

function buildDisplayTitle(song: Song): string {
  const title = song.metadata.title?.trim();
  const artist = song.metadata.artist?.trim();

  if (title && artist) {
    return `${title} - ${artist}`;
  }

  if (title) {
    return title;
  }

  if (artist) {
    return artist;
  }

  return buildFallbackTitle(song);
}

export class SongbookService {
  constructor(
    private readonly repository = new SongRepository(),
    private readonly parser = new ChordProParser()
  ) {}

  async loadSongbook(folderPath: string): Promise<Songbook> {
    const filePaths = await this.repository.listSongs(folderPath);
    const songs = [];

    for (const filePath of filePaths) {
      const chordProText = await this.repository.readSong(filePath);
      const song = this.parser.parse(chordProText);
      songs.push({
        filePath,
        displayTitle: buildDisplayTitle(song)
      });
    }

    songs.sort((left, right) => left.displayTitle.localeCompare(right.displayTitle, undefined, {
      sensitivity: "base"
    }));

    return {
      path: folderPath,
      songs
    };
  }

  async openSong(filePath: string): Promise<LoadedSongFile> {
    const chordProText = await this.repository.readSong(filePath);
    const song = this.parser.parse(chordProText);

    return {
      filePath,
      fileName: getFileName(filePath),
      chordProText,
      song
    };
  }

  async saveSong(filePath: string, chordProText: string): Promise<void> {
    await this.repository.writeSong(filePath, chordProText);
  }
}
