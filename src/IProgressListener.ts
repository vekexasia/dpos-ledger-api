export interface IProgressListener {
  onStart(): void;
  onChunkProcessed(chunk: Buffer): void;
  onEnd(): void;
}
