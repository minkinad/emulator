export type ErrorCode =
  | 'INVALID_IMAGE'
  | 'FETCH_OUT_OF_BOUNDS'
  | 'INVALID_OPCODE'
  | 'INVALID_ENCODING'
  | 'DATA_OUT_OF_BOUNDS'
  | 'INVALID_STEP_LIMIT';

export interface CpuFault {
  readonly code: ErrorCode;
  readonly message: string;
  readonly address: number;
  readonly word?: number;
}

export class MachineError extends Error {
  constructor(readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'MachineError';
  }
}

export function isUnsigned(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}
