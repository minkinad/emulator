import { ADDRESS_MODES, ISA, MACHINE } from './isa.js';
import type { DecodedInstruction, Instruction, Mnemonic } from './isa.js';
import { isUnsigned, MachineError } from './errors.js';

const byOpcode = new Map<number, Mnemonic>(
  (Object.keys(ISA) as Mnemonic[]).map(op => [ISA[op].opcode, op]),
);

function requireEncoding(condition: boolean, message: string): asserts condition {
  if (!condition) throw new MachineError('INVALID_ENCODING', message);
}

function field(value: number, max: number, name: string): number {
  requireEncoding(isUnsigned(value, max), `Поле ${name}: требуется целое число от 0 до ${max}.`);
  return value;
}

export function hex(value: number, width = 4): string {
  return value.toString(16).toUpperCase().padStart(width, '0');
}

export function formatInstruction(instruction: Instruction): string {
  const i = instruction;
  switch (i.op) {
    case 'HALT': return 'HALT';
    case 'MOV': return `MOV R${i.d}, ${i.mode === 'register' ? `R${i.value}` : `0x${hex(i.value)}`}`;
    case 'LD':
    case 'ST': {
      const address = i.mode === 'direct' ? `0x${hex(i.value)}` : `R${i.value}`;
      return i.op === 'LD' ? `LD R${i.d}, [${address}]` : `ST [${address}], R${i.d}`;
    }
    case 'JMP':
    case 'JZ':
    case 'JNZ': return `${i.op} 0x${hex(i.target)}`;
    case 'CMP': return `CMP R${i.a}, R${i.b}`;
    case 'SAR': return `SAR R${i.d}, R${i.a}, ${i.shift}`;
    default: return `${i.op} R${i.d}, R${i.a}, R${i.b}`;
  }
}

/** На входе только сырое машинное слово, без исходного текста программы. */
export function decode(word: number): DecodedInstruction {
  requireEncoding(isUnsigned(word, 0xffff_ffff), 'Инструкция должна быть беззнаковым 32-битным целым.');
  const opcode = word >>> 24;
  const op = byOpcode.get(opcode);
  if (op === undefined) throw new MachineError('INVALID_OPCODE', `Неизвестный код операции 0x${hex(opcode, 2)}.`);
  const format = ISA[op].format;
  const d = (word >>> 20) & 15;
  const a = (word >>> 16) & 15;
  const b = (word >>> 12) & 15;
  const v = word & 0xffff;
  let instruction: Instruction;
  let fields: Record<string, number>;
  switch (op) {
    case 'HALT':
      requireEncoding(word === 0, 'Резервные биты HALT должны быть нулевыми.');
      instruction = { op };
      fields = { OP: opcode, reserved: 0 };
      break;
    case 'MOV':
    case 'LD':
    case 'ST': {
      fields = { OP: opcode, D: d, M: a, V: v };
      if (op === 'MOV') {
        requireEncoding(a === ADDRESS_MODES.register || a === ADDRESS_MODES.immediate, 'MOV допускает только регистр или непосредственное значение.');
        if (a === ADDRESS_MODES.register) requireEncoding(v < MACHINE.registerCount, 'Номер регистра MOV содержит лишние биты.');
        instruction = { op, d, mode: a === ADDRESS_MODES.register ? 'register' : 'immediate', value: v };
      } else {
        requireEncoding(a === ADDRESS_MODES.direct || a === ADDRESS_MODES.indirect, `${op} требует прямой или косвенно-регистровый адрес.`);
        requireEncoding(v < (a === ADDRESS_MODES.direct ? MACHINE.dataSize : MACHINE.registerCount), `${op}: адрес или номер регистра содержит лишние биты.`);
        instruction = { op, d, mode: a === ADDRESS_MODES.direct ? 'direct' : 'indirect', value: v };
      }
      break;
    }
    case 'JMP':
    case 'JZ':
    case 'JNZ':
      requireEncoding((word & 0x00ff_0000) === 0 && v < MACHINE.codeSize, 'Переход: ненулевой резерв или адрес вне памяти команд.');
      instruction = { op, target: v };
      fields = { OP: opcode, reserved: 0, T: v };
      break;
    default:
      requireEncoding((word & 0xfff) === 0, `${op}: резервные биты должны быть нулевыми.`);
      fields = { OP: opcode, D: d, A: a, [op === 'SAR' ? 'n' : 'B']: b, reserved: 0 };
      if (op === 'CMP') {
        requireEncoding(d === 0, 'CMP не имеет получателя: поле D должно быть нулевым.');
        instruction = { op, a, b };
      } else if (op === 'SAR') {
        instruction = { op, d, a, shift: b };
      } else {
        instruction = { op, d, a, b };
      }
  }
  return { word, format, fields, instruction, assembly: formatInstruction(instruction) };
}

/** Операнды уже разобраны; разбор ассемблерных строк добавляется отдельным модулем. */
export function encode(instruction: Instruction): number {
  const i = instruction;
  const definition = ISA[i.op];
  if (definition === undefined) throw new MachineError('INVALID_OPCODE', 'Неизвестная операция кодирования.');
  let word = definition.opcode * 0x100_0000;
  const register = (value: number, name: string) => field(value, MACHINE.registerCount - 1, name);
  switch (i.op) {
    case 'HALT': break;
    case 'MOV':
    case 'LD':
    case 'ST': {
      const valid = i.op === 'MOV'
        ? i.mode === 'register' || i.mode === 'immediate'
        : i.mode === 'direct' || i.mode === 'indirect';
      requireEncoding(valid, `Недопустимая адресация ${i.op}.`);
      const max = i.mode === 'immediate' ? 0xffff : i.mode === 'direct' ? MACHINE.dataSize - 1 : MACHINE.registerCount - 1;
      word += register(i.d, 'D') * 0x10_0000 + ADDRESS_MODES[i.mode] * 0x1_0000 + field(i.value, max, 'V');
      break;
    }
    case 'JMP':
    case 'JZ':
    case 'JNZ': word += field(i.target, MACHINE.codeSize - 1, 'T'); break;
    case 'CMP': word += register(i.a, 'A') * 0x1_0000 + register(i.b, 'B') * 0x1000; break;
    case 'SAR': word += register(i.d, 'D') * 0x10_0000 + register(i.a, 'A') * 0x1_0000 + field(i.shift, 15, 'n') * 0x1000; break;
    default: word += register(i.d, 'D') * 0x10_0000 + register(i.a, 'A') * 0x1_0000 + register(i.b, 'B') * 0x1000;
  }
  // Единые ограничения для сборки и чтения слова.
  return decode(word).word;
}
