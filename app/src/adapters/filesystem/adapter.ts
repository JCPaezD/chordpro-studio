export interface FilesystemAdapter {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
}
