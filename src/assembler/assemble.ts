import { encode } from '../core/index.js';
import type { Instruction } from '../core/index.js';
import { branchTarget, literal, memoryOperand, register } from './operands.js';
import { parseSource } from './parser.js';
import type { AssemblyResult, SourceMapEntry } from './types.js';
import type { LabelDefinition, ParsedLine, Token } from './parser.js';

function encodeLine(line: ParsedLine, labels: ReadonlyMap<string, LabelDefinition>): number {
  const { op, operands } = line;
  // Число операндов уже проверено первым проходом.
  const first = operands[0]!;
  const second = operands[1]!;
  const third = operands[2]!;
  let instruction: Instruction;
  switch (op) {
    case 'HALT': instruction = { op }; break;
    case 'MOV': instruction = moveInstruction(first, second); break;
    case 'LD': instruction = { op, d: register(first), ...memoryOperand(second) }; break;
    case 'ST': instruction = { op, ...memoryOperand(first), d: register(second) }; break;
    case 'CMP': instruction = { op, a: register(first), b: register(second) }; break;
    case 'SAR': instruction = { op, d: register(first), a: register(second), shift: literal(third, 'shift') }; break;
    case 'JMP':
    case 'JZ':
    case 'JNZ': instruction = { op, target: branchTarget(first, labels) }; break;
    default: instruction = { op, d: register(first), a: register(second), b: register(third) };
  }
  return encode(instruction);
}

function moveInstruction(destination: Token, source: Token): Instruction {
  return {
    op: 'MOV',
    d: register(destination),
    ...(/^r/i.test(source.text)
      ? { mode: 'register' as const, value: register(source) }
      : { mode: 'immediate' as const, value: literal(source, 'immediate') }),
  };
}

function sourceMapEntry(address: number, line: ParsedLine): SourceMapEntry {
  return { address, ...line.location, text: line.text };
}

/** Чистая сборка: не загружает и не изменяет машину, ошибочный образ не возвращается. */
export function assemble(source: string): AssemblyResult {
  const { lines, labels } = parseSource(source);
  const instructions: number[] = [];
  const sourceMap: SourceMapEntry[] = [];
  for (const [address, line] of lines.entries()) {
    instructions.push(encodeLine(line, labels));
    sourceMap.push(sourceMapEntry(address, line));
  }
  return {
    image: { instructions, entryPoint: 0, data: [] },
    labels: new Map([...labels].map(([name, definition]) => [name, definition.address])),
    sourceMap,
  };
}
