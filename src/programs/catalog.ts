import { SUM_SOURCE, DOT_SOURCE } from './sources.generated.js';

export interface ProgramExample {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly data: string;
  readonly resultWords?: 2 | 3;
}

/** Только исходники и исходные данные: все вычисления выполняет программа CPU. */
export const ARRAY_EXAMPLES = [
  {
    id: 'array-sum', name: 'Сумма массива · 32 бита',
    description: '10 знаковых элементов → два слова с адреса 0x0300',
    source: SUM_SOURCE,
    data: '0x0100: 10, 1, -2, 3, -4, 5, -6, 7, -8, 9, -10',
    resultWords: 2,
  },
  {
    id: 'array-dot', name: 'Свёртка массивов · 48 бит',
    description: '10 пар элементов → три слова и статус с адреса 0x0300',
    source: DOT_SOURCE,
    data: '0x0100: 10, -32768, -32768, -32768, -32768, -32768, -32768, -32768, -32768, -32768, -32768\n0x0200: 10, -32768, -32768, -32768, -32768, -32768, -32768, -32768, -32768, -32768, -32768',
    resultWords: 3,
  },
] as const satisfies readonly ProgramExample[];
