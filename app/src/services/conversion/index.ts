import type { ConversionService } from "../contracts";
import type { Song } from "../../domain/song/song";

const emptySong: Song = {
  metadata: {
    title: "",
    artist: ""
  },
  sections: []
};

export const conversionServicePlaceholder: ConversionService = {
  async convert(): Promise<Song> {
    return emptySong;
  }
};
