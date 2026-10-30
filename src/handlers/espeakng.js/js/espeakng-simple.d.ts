export declare class SimpleTTS {
  constructor(options: Record<string, unknown>);
  onReady(callback: (error?: unknown) => void): void;
  speak(text: string, callback: (audio: Float32Array, sampleRate: number) => void): void;
}
