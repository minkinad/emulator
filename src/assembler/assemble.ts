import { encode } from '../core/index.js';
import type { Instruction } from '../core/index.js';
import { branchTarget, literal, memoryOperand, register } from './operands.js';
import { parseSource } from './parser.js';
import type { AssemblyResult, SourceMapEntry } from './types.js';

/** Чистая сборка: не загружает и не изменяет машину, ошибочный образ не возвращается. */
export function assemble(source: string): AssemblyResult {
  const { lines, labels } = parseSource(source);
  const instructions: number[] = [];
  const sourceMap: SourceMapEntry[] = [];
  for (const [address, line] of lines.entries()) {
    const { op, operands } = line;
    // Число операндов уже проверено первым проходом.
    const first = operands[0]!;
    const second = operands[1]!;
    const third = operands[2]!;
    let instruction: Instruction;
    switch (op) {
      case 'HALT': instruction = { op }; break;
      case 'MOV':
        instruction = { op, d: register(first), ...(/^r/i.test(second.text)
          ? { mode: 'register' as const, value: register(second) }
          : { mode: 'immediate' as const, value: literal(second, 'immediate') }) };
        break;
      case 'LD': instruction = { op, d: register(first), ...memoryOperand(second) }; break;
      case 'ST': instruction = { op, ...memoryOperand(first), d: register(second) }; break;
      case 'CMP': instruction = { op, a: register(first), b: register(second) }; break;
      case 'SAR': instruction = { op, d: register(first), a: register(second), shift: literal(third, 'shift') }; break;
      case 'JMP':
      case 'JZ':
      case 'JNZ': instruction = { op, target: branchTarget(first, labels) }; break;
      default: instruction = { op, d: register(first), a: register(second), b: register(third) };
    }
    instructions.push(encode(instruction));
    sourceMap.push({ address, ...line.location, text: line.text });
  }
  return {
    image: { instructions, entryPoint: 0, data: [] },
    labels: new Map([...labels].map(([name, definition]) => [name, definition.address])),
    sourceMap,
  };
}
