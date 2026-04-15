import { exists, readDir, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

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

  async songExists(filePath: string): Promise<boolean> {
    return exists(filePath);
  }

  async renameSong(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath);
  }

  async deleteSong(filePath: string): Promise<void> {
    await remove(filePath);
  }
}

