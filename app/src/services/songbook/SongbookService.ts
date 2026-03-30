import type { Song } from "../../domain/song";
import type { Songbook } from "../../domain/songbook";
import { SongRepository } from "../../adapters/filesystem/SongRepository";
import { buildSongDisplayTitle } from "../../domain/song/deriveDisplayTitle";
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

export class SongbookService {
  constructor(
    private readonly repository = new SongRepository(),
    private readonly parser = new ChordProParser()
  ) {}

  async listSongFiles(folderPath: string): Promise<string[]> {
    const filePaths = await this.repository.listSongs(folderPath);
    filePaths.sort((left, right) => getFileName(left).localeCompare(getFileName(right), undefined, {
      sensitivity: "base"
    }));
    return filePaths;
  }

  async loadSongbook(folderPath: string): Promise<Songbook> {
    const filePaths = await this.listSongFiles(folderPath);
    const songs = [];

    for (const filePath of filePaths) {
      const chordProText = await this.repository.readSong(filePath);
      const song = this.parser.parse(chordProText);
      songs.push({
        filePath,
        displayTitle: buildSongDisplayTitle(chordProText, song.metadata, getFileName(filePath))
      });
    }

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
