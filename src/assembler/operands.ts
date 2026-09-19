import { MACHINE } from '../core/index.js';
import { AssemblyError } from './errors.js';
import { LABEL_PATTERN } from './parser.js';
import type { LabelDefinition, Token } from './parser.js';

export function register(token: Token): number {
  const match = /^R(0|[1-9][0-9]*)$/i.exec(token.text);
  const value = match === null ? NaN : Number(match[1]);
  if (!Number.isInteger(value) || value < 0 || value >= MACHINE.registerCount) {
    throw new AssemblyError('INVALID_REGISTER', token, 'Ожидается регистр R0…R15.');
  }
  return value;
}

/** BigInt исключает округление большого литерала до проверки диапазона. */
export function literal(token: Token, kind: 'immediate' | 'address' | 'shift'): number {
  const isHex = /^0x[0-9a-f]+$/i.test(token.text);
  const decimal = kind === 'immediate' ? /^[+-]?[0-9]+$/ : /^[0-9]+$/;
  if (!isHex && !decimal.test(token.text)) {
    throw new AssemblyError('INVALID_LITERAL', token, 'Ожидается десятичное число или hex-литерал 0x…; выражения и знаки перед hex не поддерживаются.');
  }
  const value = BigInt(token.text);
  const min = kind === 'immediate' && !isHex ? -32768n : 0n;
  const max = kind === 'immediate' ? (isHex ? 65535n : 32767n) : kind === 'shift' ? 15n : 65535n;
  if (value < min || value > max) throw new AssemblyError('OUT_OF_RANGE', token, `Значение должно быть в диапазоне ${min}…${max}.`);
  return Number(value < 0 ? value + 65536n : value);
}

function address(token: Token, limit: number): number {
  const value = literal(token, 'address');
  if (value >= limit) throw new AssemblyError('OUT_OF_RANGE', token, `Адрес должен быть в диапазоне 0…${limit - 1}.`);
  return value;
}

export function memoryOperand(token: Token): { mode: 'direct' | 'indirect'; value: number } {
  const match = /^\[\s*([^\[\]]+?)\s*\]$/.exec(token.text);
  if (match === null) throw new AssemblyError('INVALID_OPERAND', token, 'Адрес памяти задаётся в скобках: [0x0100] или [R4].');
  const inner = match[1]!.trim();
  const operand = { ...token, text: inner, column: token.column + token.text.indexOf(inner) };
  return /^r/i.test(inner)
    ? { mode: 'indirect', value: register(operand) }
    : { mode: 'direct', value: address(operand, MACHINE.dataSize) };
}

export function branchTarget(token: Token, labels: ReadonlyMap<string, LabelDefinition>): number {
  if (!LABEL_PATTERN.test(token.text)) return address(token, MACHINE.codeSize);
  const definition = labels.get(token.text);
  if (definition === undefined) throw new AssemblyError('UNDEFINED_LABEL', token, `Метка «${token.text}» не определена; регистр букв имеет значение.`);
  return definition.address;
}
