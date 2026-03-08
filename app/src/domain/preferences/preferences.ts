export interface UserPreferences {
  maxColumns: 1 | 2;
  compactRepetitions: boolean;
  chordNotation: "american";
}

export const defaultPreferences: UserPreferences = {
  maxColumns: 1,
  compactRepetitions: true,
  chordNotation: "american"
};
