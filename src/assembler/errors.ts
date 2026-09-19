import type { SourceLocation } from './types.js';

export type AssemblyErrorCode =
  | 'EMPTY_PROGRAM'
  | 'PROGRAM_TOO_LARGE'
  | 'INVALID_LABEL'
  | 'DUPLICATE_LABEL'
  | 'UNDEFINED_LABEL'
  | 'UNKNOWN_INSTRUCTION'
  | 'OPERAND_COUNT'
  | 'INVALID_REGISTER'
  | 'INVALID_LITERAL'
  | 'INVALID_OPERAND'
  | 'OUT_OF_RANGE';

export interface AssemblyDiagnostic extends SourceLocation {
  readonly code: AssemblyErrorCode;
  readonly message: string;
}

export class AssemblyError extends Error {
  readonly diagnostic: AssemblyDiagnostic;

  constructor(code: AssemblyErrorCode, location: SourceLocation, message: string) {
    super(`Строка ${location.line}, позиция ${location.column}: ${message}`);
    this.name = 'AssemblyError';
    this.diagnostic = { code, line: location.line, column: location.column, message };
  }
}
