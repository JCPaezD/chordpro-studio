import { join } from "@tauri-apps/api/path";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export class SongRepository {
  async listSongs(folderPath: string): Promise<string[]> {
    const entries = await readDir(folderPath);
    const songFiles: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile || !entry.name.toLowerCase().endsWith(".cho")) {
        continue;
      }

      songFiles.push(await join(folderPath, entry.name));
    }

    return songFiles;
  }

  async readSong(filePath: string): Promise<string> {
    return readTextFile(filePath);
  }

  async writeSong(filePath: string, chordProText: string): Promise<void> {
    await writeTextFile(filePath, chordProText);
  }
}
