/** Единый справочник кодов для кодека, ассемблера и интерфейса. */
export const MACHINE = {
  wordBits: 16,
  instructionBits: 32,
  registerCount: 16,
  codeSize: 1024,
  dataSize: 4096,
  defaultStepLimit: 100_000,
} as const;

export const ISA = {
  HALT: { opcode: 0x00, format: 'H' },
  MOV: { opcode: 0x01, format: 'X' },
  LD: { opcode: 0x02, format: 'X' },
  ST: { opcode: 0x03, format: 'X' },
  ADD: { opcode: 0x10, format: 'R' },
  ADC: { opcode: 0x11, format: 'R' },
  SUB: { opcode: 0x12, format: 'R' },
  MULLO: { opcode: 0x13, format: 'R' },
  MULHI: { opcode: 0x14, format: 'R' },
  SAR: { opcode: 0x15, format: 'S' },
  AND: { opcode: 0x16, format: 'R' },
  OR: { opcode: 0x17, format: 'R' },
  XOR: { opcode: 0x18, format: 'R' },
  CMP: { opcode: 0x19, format: 'R' },
  JMP: { opcode: 0x20, format: 'J' },
  JZ: { opcode: 0x21, format: 'J' },
  JNZ: { opcode: 0x22, format: 'J' },
} as const;

export const ADDRESS_MODES = {
  register: 0,
  immediate: 1,
  direct: 2,
  indirect: 3,
} as const;

export type Mnemonic = keyof typeof ISA;
export type InstructionFormat = (typeof ISA)[Mnemonic]['format'];
export type BinaryOperation = 'ADD' | 'ADC' | 'SUB' | 'MULLO' | 'MULHI' | 'AND' | 'OR' | 'XOR';
export type AluOperation = BinaryOperation | 'CMP' | 'SAR';

export type Instruction =
  | { readonly op: 'HALT' }
  | { readonly op: BinaryOperation; readonly d: number; readonly a: number; readonly b: number }
  | { readonly op: 'CMP'; readonly a: number; readonly b: number }
  | { readonly op: 'SAR'; readonly d: number; readonly a: number; readonly shift: number }
  | { readonly op: 'MOV'; readonly d: number; readonly mode: 'register' | 'immediate'; readonly value: number }
  | { readonly op: 'LD' | 'ST'; readonly d: number; readonly mode: 'direct' | 'indirect'; readonly value: number }
  | { readonly op: 'JMP' | 'JZ' | 'JNZ'; readonly target: number };

export interface DecodedInstruction {
  readonly word: number;
  readonly format: InstructionFormat;
  readonly fields: Readonly<Record<string, number>>;
  readonly instruction: Instruction;
  readonly assembly: string;
}
