export interface FilesystemAdapter {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
}

export interface SongRepositoryAdapter {
  listSongs(folderPath: string): Promise<string[]>;
  readSong(filePath: string): Promise<string>;
  writeSong(filePath: string, chordProText: string): Promise<void>;
}
