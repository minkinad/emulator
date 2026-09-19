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
    let offset = content.search(/\S/);
    if (offset === -1) continue;
    const colon = content.indexOf(':', offset);
    if (colon !== -1) {
      const label = content.slice(offset, colon).trim();
      const location = { line, column: offset + 1 };
      if (!LABEL_PATTERN.test(label)) throw new AssemblyError('INVALID_LABEL', location, 'Метка должна начинаться с латинской буквы или подчёркивания и содержать только буквы, цифры и подчёркивания.');
      if (labels.has(label)) throw new AssemblyError('DUPLICATE_LABEL', location, `Метка «${label}» уже определена в строке ${labels.get(label)!.line}.`);
      labels.set(label, { ...location, address: lines.length });
      const after = content.slice(colon + 1).search(/\S/);
      if (after === -1) continue;
      offset = colon + 1 + after;
      if (content.indexOf(':', offset) !== -1) throw new AssemblyError('INVALID_LABEL', { line, column: offset + 1 }, 'На одной строке допускается одна метка.');
    }
    const match = /^\S+/.exec(content.slice(offset))!;
    const name = match[0].toUpperCase();
    const location = { line, column: offset + 1 };
    if (!Object.hasOwn(ISA, name)) throw new AssemblyError('UNKNOWN_INSTRUCTION', location, `Неизвестная команда «${match[0]}».`);
    if (lines.length >= MACHINE.codeSize) throw new AssemblyError('PROGRAM_TOO_LARGE', location, `Программа превышает ${MACHINE.codeSize} инструкции.`);
    const op = name as Mnemonic;
    const format = ISA[op].format;
    const count = format === 'H' ? 0 : format === 'J' ? 1 : format === 'X' || op === 'CMP' ? 2 : 3;
    const rest = content.slice(offset + match[0].length);
    const operands: Token[] = [];
    let start = offset + match[0].length;
    if (rest.trim()) {
      for (const part of rest.split(',')) {
        const padding = part.search(/\S/);
        operands.push({ text: part.trim(), line, column: start + (padding < 0 ? 0 : padding) + 1 });
        start += part.length + 1;
      }
    }
    if (operands.length !== count || operands.some(token => token.text === '')) {
      throw new AssemblyError('OPERAND_COUNT', location, `Команда ${op} требует ${count} операндов, разделённых запятыми.`);
    }
    lines.push({ op, location, operands, text });
  }
  if (lines.length === 0) throw new AssemblyError('EMPTY_PROGRAM', { line: 1, column: 1 }, 'Программа не содержит инструкций.');
  for (const [name, definition] of labels) {
    if (definition.address >= lines.length) throw new AssemblyError('INVALID_LABEL', definition, `После метки «${name}» должна находиться инструкция.`);
  }
  return { lines, labels };
}
