import type { AluOperation } from './isa.js';
import type { Flags } from './types.js';

export function word(value: number): number {
  return ((value % 0x1_0000) + 0x1_0000) % 0x1_0000;
}

export function signed(value: number): number {
  return value < 0x8000 ? value : value - 0x1_0000;
}

export function clearFlags(): Flags {
  return { zf: false, nf: false, cf: false, of: false };
}

export interface AluResult {
  readonly value: number;
  readonly flags: Flags;
}

/** Внутренняя операция: a/b — проверенные слова; для SAR b — сдвиг 0…15. */
export function calculate(op: AluOperation, a: number, b: number, flags: Flags): AluResult {
  let result: number;
  let cf = false;
  let of = false;
  const overflows = (value: number) => value < -32768 || value > 32767;
  switch (op) {
    case 'ADD':
    case 'ADC': {
      const carry = op === 'ADC' && flags.cf ? 1 : 0;
      result = a + b + carry;
      cf = result > 0xffff;
      of = overflows(signed(a) + signed(b) + carry);
      break;
    }
    case 'SUB':
    case 'CMP':
      result = a - b;
      cf = a < b;
      of = overflows(signed(a) - signed(b));
      break;
    case 'MULLO':
    case 'MULHI': {
      // Произведение 16 × 16 бит точно представимо в number.
      const product = signed(a) * signed(b);
      result = op === 'MULLO' ? product : Math.floor(product / 0x1_0000);
      cf = of = overflows(product);
      break;
    }
    case 'SAR':
      if (b === 0) return { value: a, flags: { ...flags } };
      result = Math.floor(signed(a) / 2 ** b);
      cf = ((a >>> (b - 1)) & 1) !== 0;
      break;
    case 'AND': result = a & b; break;
    case 'OR': result = a | b; break;
    case 'XOR': result = a ^ b; break;
  }
  const value = word(result);
  return { value, flags: { zf: value === 0, nf: value >= 0x8000, cf, of } };
}
