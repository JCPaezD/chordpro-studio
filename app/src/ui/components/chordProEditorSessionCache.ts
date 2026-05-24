export type ChordProEditorSessionSnapshot = {
  doc: string;
  stateJson: unknown;
};

const editorStateCache = new Map<string, ChordProEditorSessionSnapshot>();

export function getCachedChordProEditorSnapshot(key: string): ChordProEditorSessionSnapshot | null {
  return editorStateCache.get(key) ?? null;
}

export function setCachedChordProEditorSnapshot(key: string, snapshot: ChordProEditorSessionSnapshot): void {
  editorStateCache.set(key, snapshot);
}

export function deleteCachedChordProEditorSnapshot(key: string): void {
  editorStateCache.delete(key);
}
