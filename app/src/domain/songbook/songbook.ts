export type SongbookEntry = {
  filePath: string;
  displayTitle: string;
};

export type Songbook = {
  path: string;
  songs: SongbookEntry[];
};
