import { ISA, MACHINE } from '../core/index.js';
import type { Mnemonic } from '../core/index.js';
import { AssemblyError } from './errors.js';
import type { SourceLocation } from './types.js';

export interface Token extends SourceLocation {
  readonly text: string;
}

export interface ParsedLine {
  readonly op: Mnemonic;
  readonly location: SourceLocation;
  readonly operands: readonly Token[];
  readonly text: string;
}

export interface LabelDefinition extends SourceLocation {
  readonly address: number;
}

export const LABEL_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseLabel(content: string, line: number, address: number, labels: Map<string, LabelDefinition>, offset: number): number | null {
  const colon = content.indexOf(':', offset);
  if (colon === -1) return offset;

  const label = content.slice(offset, colon).trim();
  const location = { line, column: offset + 1 };
  if (!LABEL_PATTERN.test(label)) {
    throw new AssemblyError('INVALID_LABEL', location, 'Метка должна начинаться с латинской буквы или подчёркивания и содержать только буквы, цифры и подчёркивания.');
  }
  const previous = labels.get(label);
  if (previous !== undefined) {
    throw new AssemblyError('DUPLICATE_LABEL', location, `Метка «${label}» уже определена в строке ${previous.line}.`);
  }
  labels.set(label, { ...location, address });

  const afterLabel = content.slice(colon + 1).search(/\S/);
  if (afterLabel === -1) return null;
  const instructionOffset = colon + 1 + afterLabel;
  if (content.indexOf(':', instructionOffset) !== -1) {
    throw new AssemblyError('INVALID_LABEL', { line, column: instructionOffset + 1 }, 'На одной строке допускается одна метка.');
  }
  return instructionOffset;
}

function operandCount(op: Mnemonic): number {
  const format = ISA[op].format;
  return format === 'H' ? 0 : format === 'J' ? 1 : format === 'X' || op === 'CMP' ? 2 : 3;
}

function parseOperands(rest: string, op: Mnemonic, location: SourceLocation): Token[] {
  const expected = operandCount(op);
  const operands: Token[] = [];
  let column = location.column + op.length;
  if (rest.trim()) {
    for (const part of rest.split(',')) {
      const padding = part.search(/\S/);
      operands.push({ text: part.trim(), line: location.line, column: column + (padding < 0 ? 0 : padding) });
      column += part.length + 1;
    }
  }
  if (operands.length !== expected || operands.some(token => token.text === '')) {
    throw new AssemblyError('OPERAND_COUNT', location, `Команда ${op} требует ${expected} операндов, разделённых запятыми.`);
  }
  return operands;
}

function parseInstruction(text: string, content: string, line: number, offset: number, address: number): ParsedLine {
  const match = /^\S+/.exec(content.slice(offset))!;
  const name = match[0].toUpperCase();
  const location = { line, column: offset + 1 };
  if (!Object.hasOwn(ISA, name)) {
    throw new AssemblyError('UNKNOWN_INSTRUCTION', location, `Неизвестная команда «${match[0]}».`);
  }
  if (address >= MACHINE.codeSize) {
    throw new AssemblyError('PROGRAM_TOO_LARGE', location, `Программа превышает ${MACHINE.codeSize} инструкции.`);
  }
  const op = name as Mnemonic;
  const rest = content.slice(offset + match[0].length);
  const operands = parseOperands(rest, op, { line, column: offset + 1 });
  return { op, location, operands, text };
}

/** Первый проход: строки и метки, без разрешения ссылок на будущие команды. */
export function parseSource(source: string): {
  lines: ParsedLine[];
  labels: Map<string, LabelDefinition>;
} {
  const lines: ParsedLine[] = [];
  const labels = new Map<string, LabelDefinition>();
  const rawLines = source.split(/\r\n|\n|\r/);
  for (const [index, text] of rawLines.entries()) {
    const line = index + 1;
    const content = text.split(';', 1)[0]!;
    const first = content.search(/\S/);
    if (first === -1) continue;
    const offset = parseLabel(content, line, lines.length, labels, first);
    if (offset === null) continue;
    lines.push(parseInstruction(text, content, line, offset, lines.length));
  }
  if (lines.length === 0) throw new AssemblyError('EMPTY_PROGRAM', { line: 1, column: 1 }, 'Программа не содержит инструкций.');
  validateLabels(labels, lines.length);
  return { lines, labels };
}

function validateLabels(labels: ReadonlyMap<string, LabelDefinition>, instructionCount: number): void {
  for (const [name, definition] of labels) {
    if (definition.address >= instructionCount) {
      throw new AssemblyError('INVALID_LABEL', definition, `После метки «${name}» должна находиться инструкция.`);
    }
  }
}
