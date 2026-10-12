declare module 'bidi-js' {
  type Levels = { levels: Uint8Array; paragraphs: { start: number; end: number; level: number }[] };
  export default function factory(): {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): Levels;
    getReorderSegments(
      text: string,
      levels: Levels,
      start?: number,
      end?: number,
    ): [number, number][];
    getMirroredCharacter(character: string): string | null;
  };
}
