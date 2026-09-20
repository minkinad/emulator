import { ARRAY_EXAMPLES } from '../programs/catalog.js';
import type { ProgramExample } from '../programs/catalog.js';

export const EXAMPLES: readonly [ProgramExample, ...ProgramExample[]] = [
  {
    id: 'countdown', name: 'Сумма в цикле', description: '3 + 2 + 1 → ячейка 0x0300',
    source: `; Сумма чисел в цикле\n    MOV R0, 0\n    MOV R3, 3\n    MOV R4, 1\nloop:\n    ADD R0, R0, R3\n    SUB R3, R3, R4\n    JNZ loop\n    ST [0x0300], R0\n    HALT`,
    data: '; Начальные данные можно задать ниже\n; 0x0100: 10, -2, 3',
  },
  {
    id: 'memory', name: 'Работа с памятью', description: '−7 + 12 → ячейка 0x0300',
    source: `; Загрузка, сложение и сохранение\n    LD R0, [0x0100]\n    LD R1, [0x0101]\n    ADD R0, R0, R1\n    ST [0x0300], R0\n    HALT`,
    data: '0x0100: -7, 12',
  },
  {
    id: 'carry', name: 'Перенос между словами', description: '0x0000FFFF + 1 → 0x00010000',
    source: `; R1:R0 — число из двух слов\n    MOV R0, 0xFFFF\n    MOV R1, 0\n    MOV R2, 1\n    MOV R4, 0\n    ADD R0, R0, R2\n    ADC R1, R1, R4\n    ST [0x0300], R0\n    ST [0x0301], R1\n    HALT`,
    data: '',
  },
  ...ARRAY_EXAMPLES,
];
