import { MACHINE } from '../../core/index.js';
import type { ProgramImage } from '../../core/index.js';

export class DataInputError extends Error {
  constructor(readonly line: number, message: string) {
    super(`Строка данных ${line}: ${message}`);
    this.name = 'DataInputError';
  }
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
    const start = BigInt(match[1]!);
    if (start >= BigInt(MACHINE.dataSize)) throw new DataInputError(line, 'адрес должен быть в диапазоне 0…4095.');
    for (const [offset, rawValue] of match[2]!.split(',').entries()) {
      const valueText = rawValue.trim();
      const hex = /^0x[0-9a-f]+$/i.test(valueText);
      if (!hex && !/^[+-]?[0-9]+$/.test(valueText)) throw new DataInputError(line, `неверное значение «${valueText}».`);
      const value = BigInt(valueText);
      if (value < (hex ? 0n : -32768n) || value > (hex ? 65535n : 32767n)) {
        throw new DataInputError(line, 'значение должно быть −32768…32767 или 0x0000…0xFFFF.');
      }
      const address = Number(start) + offset;
      if (address >= MACHINE.dataSize) throw new DataInputError(line, 'данные выходят за адрес 4095.');
      if (occupied.has(address)) throw new DataInputError(line, `ячейка ${address} указана повторно.`);
      occupied.add(address);
      data.push({ address, value: Number(BigInt.asUintN(16, value)) });
    }
  }
  return data;
}
