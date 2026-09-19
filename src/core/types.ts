import type { CpuFault } from './errors.js';
import type { DecodedInstruction } from './isa.js';

export interface Flags {
  readonly zf: boolean;
  readonly nf: boolean;
  readonly cf: boolean;
  readonly of: boolean;
}

export interface ProgramImage {
  readonly instructions: readonly number[];
  readonly entryPoint: number;
  readonly data: readonly { readonly address: number; readonly value: number }[];
}

export type CpuStatus = 'ready' | 'halted' | 'faulted';

/** Отделённый от машины снимок: его изменение не меняет CPU. */
export interface CpuSnapshot {
  readonly registers: readonly number[];
  readonly pc: number;
  readonly ir: number;
  readonly instructionAddress: number | null;
  readonly decoded: DecodedInstruction | null;
  readonly flags: Flags;
  readonly status: CpuStatus;
  readonly steps: number;
  readonly loadedInstructions: number;
  readonly fault: CpuFault | null;
}

export interface WriteEvent {
  readonly kind: 'register' | 'data';
  readonly address: number;
  readonly before: number;
  readonly after: number;
}

export interface StepResult {
  readonly executed: boolean;
  readonly state: CpuSnapshot;
  readonly writes: readonly WriteEvent[];
}
