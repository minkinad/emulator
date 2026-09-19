import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, encode, ISA, MachineError } from '../../src/core/index.js';
import type { Instruction } from '../../src/core/index.js';

// Ожидаемые слова заданы вручную по спецификации, не вычисляются кодировщиком.
const fixtures: [Instruction, number, string][] = [
  [{ op: 'MOV', d: 4, mode: 'immediate', value: 0x101 }, 0x01410101, 'MOV R4, 0x0101'],
  [{ op: 'MOV', d: 5, mode: 'register', value: 4 }, 0x01500004, 'MOV R5, R4'],
  [{ op: 'MOV', d: 6, mode: 'immediate', value: 0xffff }, 0x0161ffff, 'MOV R6, 0xFFFF'],
  [{ op: 'LD', d: 3, mode: 'direct', value: 0x100 }, 0x02320100, 'LD R3, [0x0100]'],
  [{ op: 'LD', d: 6, mode: 'indirect', value: 4 }, 0x02630004, 'LD R6, [R4]'],
  [{ op: 'ST', d: 0, mode: 'direct', value: 0x300 }, 0x03020300, 'ST [0x0300], R0'],
  [{ op: 'ST', d: 6, mode: 'indirect', value: 4 }, 0x03630004, 'ST [R4], R6'],
  [{ op: 'ADD', d: 0, a: 1, b: 2 }, 0x10012000, 'ADD R0, R1, R2'],
  [{ op: 'ADC', d: 2, a: 2, b: 10 }, 0x1122a000, 'ADC R2, R2, R10'],
  [{ op: 'SUB', d: 15, a: 0, b: 15 }, 0x12f0f000, 'SUB R15, R0, R15'],
  [{ op: 'MULLO', d: 8, a: 6, b: 7 }, 0x13867000, 'MULLO R8, R6, R7'],
  [{ op: 'MULHI', d: 9, a: 6, b: 7 }, 0x14967000, 'MULHI R9, R6, R7'],
  [{ op: 'SAR', d: 10, a: 9, shift: 15 }, 0x15a9f000, 'SAR R10, R9, 15'],
  [{ op: 'AND', d: 0, a: 1, b: 2 }, 0x16012000, 'AND R0, R1, R2'],
  [{ op: 'OR', d: 0, a: 1, b: 2 }, 0x17012000, 'OR R0, R1, R2'],
  [{ op: 'XOR', d: 0, a: 1, b: 2 }, 0x18012000, 'XOR R0, R1, R2'],
  [{ op: 'CMP', a: 3, b: 15 }, 0x1903f000, 'CMP R3, R15'],
  [{ op: 'JMP', target: 1023 }, 0x200003ff, 'JMP 0x03FF'],
  [{ op: 'JZ', target: 15 }, 0x2100000f, 'JZ 0x000F'],
  [{ op: 'JNZ', target: 10 }, 0x2200000a, 'JNZ 0x000A'],
  [{ op: 'HALT' }, 0, 'HALT'],
];

for (const [instruction, machineWord, assembly] of fixtures) {
  test(`кодирование и декодирование: ${assembly}`, () => {
    assert.equal(encode(instruction), machineWord);
    const decoded = decode(machineWord);
    assert.deepEqual(decoded.instruction, instruction);
    assert.equal(decoded.assembly, assembly);
    assert.equal(decoded.word, machineWord);
    assert.equal(decoded.fields.OP, ISA[instruction.op].opcode);
    assert.equal(decoded.format, ISA[instruction.op].format);
  });
}

test('поля инструкции доступны отдельно для интерфейса', () => {
  assert.deepEqual(decode(0x15a9f000).fields, { OP: 0x15, D: 10, A: 9, n: 15, reserved: 0 });
  assert.deepEqual(decode(0x03630004).fields, { OP: 3, D: 6, M: 3, V: 4 });
  assert.deepEqual(decode(0x200003ff).fields, { OP: 0x20, reserved: 0, T: 1023 });
});

test('неизвестные коды и неканонические машинные слова отвергаются', () => {
  for (const value of [0xff000000, 0x04000000, 0x80000000]) {
    assert.throws(() => decode(value), { code: 'INVALID_OPCODE' });
  }
  for (const value of [0x10012001, 0x01020000, 0x02031000, 0x20000400, 0x19100000,
    0x01000010, 0x02000000, 0x03010000, 0x02021000, 0x20010000, 0x00000001,
    -1, 2 ** 32, 1.5, NaN, Infinity]) {
    assert.throws(() => decode(value), { code: 'INVALID_ENCODING' });
  }
});

test('каждый резервный бит запрещён, а все разрешённые режимы доступны', () => {
  for (const [instruction, value] of fixtures) {
    const format = ISA[instruction.op].format;
    const reserved = format === 'H' ? Array.from({ length: 24 }, (_, i) => i)
      : format === 'R' || format === 'S' ? Array.from({ length: 12 }, (_, i) => i)
      : format === 'J' ? Array.from({ length: 14 }, (_, i) => i + 10) : [];
    for (const bit of reserved) assert.throws(() => decode(value + 2 ** bit), MachineError);
  }
  for (const op of ['MOV', 'LD', 'ST'] as const) {
    for (let mode = 0; mode < 16; mode++) {
      const value = ISA[op].opcode * 2 ** 24 + mode * 2 ** 16;
      const allowed = op === 'MOV' ? [0, 1] : [2, 3];
      if (allowed.includes(mode)) assert.doesNotThrow(() => decode(value));
      else assert.throws(() => decode(value), { code: 'INVALID_ENCODING' });
    }
  }
});

test('кодировщик проверяет операнды до обрезки битов', () => {
  const invalid: Instruction[] = [
    { op: 'ADD', d: 16, a: 0, b: 0 }, { op: 'ADD', d: 0, a: -1, b: 0 },
    { op: 'CMP', a: 0, b: 1.5 }, { op: 'SAR', d: 0, a: 0, shift: 16 },
    { op: 'MOV', d: 0, mode: 'register', value: 16 },
    { op: 'MOV', d: 0, mode: 'immediate', value: -1 },
    { op: 'MOV', d: 0, mode: 'immediate', value: 65536 },
    { op: 'LD', d: 0, mode: 'direct', value: 4096 },
    { op: 'ST', d: 0, mode: 'indirect', value: 16 },
    { op: 'JMP', target: 1024 }, { op: 'JZ', target: NaN },
  ];
  for (const instruction of invalid) assert.throws(() => encode(instruction), { code: 'INVALID_ENCODING' });
  assert.equal(encode({ op: 'LD', d: 15, mode: 'direct', value: 4095 }), 0x02f20fff);
  assert.equal(encode({ op: 'MOV', d: 15, mode: 'register', value: 15 }), 0x01f0000f);
});
