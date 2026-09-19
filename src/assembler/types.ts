import type { ProgramImage } from '../core/index.js';

export interface SourceLocation {
  readonly line: number;
  readonly column: number;
}

export interface SourceMapEntry extends SourceLocation {
  readonly address: number;
  readonly text: string;
}

export interface AssemblyResult {
  readonly image: ProgramImage;
  readonly labels: ReadonlyMap<string, number>;
  readonly sourceMap: readonly SourceMapEntry[];
}
