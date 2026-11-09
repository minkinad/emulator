import { MACHINE } from '../../core/index.js';
import type { ProgramImage } from '../../core/index.js';

const WORD_SIGN = 1n << BigInt(MACHINE.wordBits - 1);
const WORD_MASK = (WORD_SIGN << 1n) - 1n;
const HEX_DIGITS = Math.ceil(MACHINE.wordBits / 4);

export class DataInputError extends Error {
  constructor(readonly line: number, message: string) {
    super(`Строка данных ${line}: ${message}`);
    this.name = 'DataInputError';
  }
}

function parseAddress(text: string, line: number): number {
  const address = BigInt(text);
  if (address >= BigInt(MACHINE.dataSize)) {
    throw new DataInputError(line, `адрес должен быть в диапазоне 0…${MACHINE.dataSize - 1}.`);
  }
  return Number(address);
}

function parseWord(text: string, line: number): number {
  const hex = /^0x[0-9a-f]+$/i.test(text);
  if (!hex && !/^[+-]?[0-9]+$/.test(text)) {
    throw new DataInputError(line, `неверное значение «${text}».`);
  }
  const value = BigInt(text);
  const min = hex ? 0n : -WORD_SIGN;
  const max = hex ? WORD_MASK : WORD_SIGN - 1n;
  if (value < min || value > max) {
    const hexMax = WORD_MASK.toString(16).toUpperCase().padStart(HEX_DIGITS, '0');
    throw new DataInputError(line, `значение должно быть ${min}…${max} или 0x${'0'.repeat(HEX_DIGITS)}…0x${hexMax}.`);
  }
  return Number(BigInt.asUintN(MACHINE.wordBits, value));
}

/** Формат строки: адрес: слово, слово. Адреса не пересекаются. */
export function parseInitialData(text: string): ProgramImage['data'] {
  const data: { address: number; value: number }[] = [];
  const occupied = new Set<number>();

  for (const [index, raw] of text.split(/\r\n|\n|\r/).entries()) {
    const line = index + 1;
    const source = raw.split(';', 1)[0]!.trim();

    if (!source) continue;
    const match = /^(0x[0-9a-f]+|[0-9]+)\s*:\s*(.+)$/i.exec(source);

    if (match === null) throw new DataInputError(line, 'ожидается «адрес: значение, значение».');
    const start = parseAddress(match[1]!, line);

    for (const [offset, rawValue] of match[2]!.split(',').entries()) {
      const valueText = rawValue.trim();
      const word = parseWord(valueText, line);
      const address = start + offset;

      if (address >= MACHINE.dataSize) throw new DataInputError(line, `данные выходят за адрес ${MACHINE.dataSize - 1}.`);

      if (occupied.has(address)) throw new DataInputError(line, `ячейка ${address} указана повторно.`);

      occupied.add(address);
      data.push({ address, value: word });
    }
  }
  return data;
}
