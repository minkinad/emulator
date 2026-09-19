import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assemble, AssemblyError } from '../../src/assembler/index.js';
import { Cpu, decode, run } from '../../src/core/index.js';
import type { AssemblyErrorCode } from '../../src/assembler/index.js';

const fixtures: [string, number][] = [
  ['HALT', 0], ['MOV R4, 0x0101', 0x01410101], ['MOV R5, R4', 0x01500004],
  ['MOV R6, -1', 0x0161ffff], ['LD R3, [0x0100]', 0x02320100], ['LD R6, [R4]', 0x02630004],
  ['ST [0x0300], R0', 0x03020300], ['ST [R4], R6', 0x03630004],
  ['ADD R0, R1, R2', 0x10012000], ['ADC R2, R2, R10', 0x1122a000],
  ['SUB R15, R0, R15', 0x12f0f000], ['MULLO R8, R6, R7', 0x13867000],
  ['MULHI R9, R6, R7', 0x14967000], ['SAR R10, R9, 15', 0x15a9f000],
  ['AND R0, R1, R2', 0x16012000], ['OR R0, R1, R2', 0x17012000], ['XOR R0, R1, R2', 0x18012000],
  ['CMP R3, R15', 0x1903f000], ['JMP 1023', 0x200003ff], ['JZ 15', 0x2100000f], ['JNZ 0x000A', 0x2200000a],
];
for (const [source, word] of fixtures) {
  test(`ассемблер: ${source} совпадает с ручным кодом`, () => {
    assert.deepEqual(assemble(source).image.instructions, [word]);
    assert.deepEqual(assemble(decode(word).assembly).image.instructions, [word]);
  });
}

test('прямые и обратные метки, несколько имён одного адреса и карта строк', () => {
  const source = '; комментарий\n\nstart:\n  JMP end ; переход вперёд\nloop: SUB R0, R0, R1\n  JNZ loop\nend:\nalias: HALT';
  const result = assemble(source);
  assert.deepEqual(result.image, { instructions: [0x20000003, 0x12001000, 0x22000001, 0], entryPoint: 0, data: [] });
  assert.deepEqual([...result.labels], [['start', 0], ['loop', 1], ['end', 3], ['alias', 3]]);
  assert.deepEqual(result.sourceMap, [
    { address: 0, line: 4, column: 3, text: '  JMP end ; переход вперёд' },
    { address: 1, line: 5, column: 7, text: 'loop: SUB R0, R0, R1' },
    { address: 2, line: 6, column: 3, text: '  JNZ loop' },
    { address: 3, line: 8, column: 8, text: 'alias: HALT' },
  ]);
});

test('команды и регистры нечувствительны к регистру, метки чувствительны', () => {
  assert.deepEqual(assemble('A: mov r15, +1\na: ld r0, [ r15 ]\njmp A\njmp a').image.instructions,
    [0x01f10001, 0x0203000f, 0x20000000, 0x20000001]);
  assert.throws(() => assemble('A: HALT\nJMP a'), (error: unknown) => error instanceof AssemblyError && error.diagnostic.code === 'UNDEFINED_LABEL');
});

test('LF, CRLF, CR, табуляции и комментарии сохраняют правильные номера строк', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const result = assemble(['; ignored: MOV R0, 9', '\tMOV\tR0, 0XFFFF', '; HALT', '\tHALT'].join(newline));
    assert.deepEqual(result.image.instructions, [0x0101ffff, 0]);
    assert.deepEqual(result.sourceMap.map(({ line, column }) => [line, column]), [[2, 2], [4, 2]]);
  }
});

test('граничные литералы и адреса принимаются без округления', () => {
  assert.deepEqual(assemble('MOV R0, -32768\nMOV R1, 32767\nMOV R2, 0xFFFF\nLD R15, [4095]\nSAR R15, R0, 0xF\nJMP 0x03FF').image.instructions,
    [0x01018000, 0x01117fff, 0x0121ffff, 0x02f20fff, 0x15f0f000, 0x200003ff]);
});

const invalid: [string, AssemblyErrorCode, number, number][] = [
  ['', 'EMPTY_PROGRAM', 1, 1], ['; text\nonly:', 'EMPTY_PROGRAM', 1, 1],
  ['.data', 'UNKNOWN_INSTRUCTION', 1, 1], ['NOPE R0', 'UNKNOWN_INSTRUCTION', 1, 1],
  ['constructor', 'UNKNOWN_INSTRUCTION', 1, 1], ['HALT 1', 'OPERAND_COUNT', 1, 1],
  ['ADD R0 R1 R2', 'OPERAND_COUNT', 1, 1], ['MOV R0,', 'OPERAND_COUNT', 1, 1],
  ['MOV R0,,1', 'OPERAND_COUNT', 1, 1], ['HALT,', 'UNKNOWN_INSTRUCTION', 1, 1],
  ['MOV R16, 1', 'INVALID_REGISTER', 1, 5], ['MOV R01, 1', 'INVALID_REGISTER', 1, 5],
  ['MOV [0], 1', 'INVALID_REGISTER', 1, 5], ['ADD R0, R1, 1', 'INVALID_REGISTER', 1, 13],
  ['MOV R0, 32768', 'OUT_OF_RANGE', 1, 9], ['MOV R0, -32769', 'OUT_OF_RANGE', 1, 9],
  ['MOV R0, 65535', 'OUT_OF_RANGE', 1, 9], ['MOV R0, 0x10000', 'OUT_OF_RANGE', 1, 9],
  ['MOV R0, 999999999999999999999999999999999999', 'OUT_OF_RANGE', 1, 9],
  ['MOV R0, -0x1', 'INVALID_LITERAL', 1, 9], ['MOV R0, 12foo', 'INVALID_LITERAL', 1, 9],
  ['MOV R0, 1e2', 'INVALID_LITERAL', 1, 9], ['MOV R0, 1+2', 'INVALID_LITERAL', 1, 9],
  ['LD R0, 1', 'INVALID_OPERAND', 1, 8], ['LD R0, [[1]]', 'INVALID_OPERAND', 1, 8],
  ['LD R0, [R16]', 'INVALID_REGISTER', 1, 9], ['LD R0, [4096]', 'OUT_OF_RANGE', 1, 9],
  ['LD R0, [-1]', 'INVALID_LITERAL', 1, 9], ['ST [R1], 2', 'INVALID_REGISTER', 1, 10],
  ['SAR R0, R1, 16', 'OUT_OF_RANGE', 1, 13], ['JMP 1024', 'OUT_OF_RANGE', 1, 5],
  ['JMP absent', 'UNDEFINED_LABEL', 1, 5], ['2bad: HALT', 'INVALID_LABEL', 1, 1],
  ['a: b: HALT', 'INVALID_LABEL', 1, 4], ['a: HALT\na: HALT', 'DUPLICATE_LABEL', 2, 1],
  ['HALT\nend:', 'INVALID_LABEL', 2, 1], ['; blank\n  MOV R0, -32769', 'OUT_OF_RANGE', 2, 11],
];
for (const [source, code, line, column] of invalid) {
  test(`диагностика ${code}: ${JSON.stringify(source)}`, () => {
    assert.throws(() => assemble(source), (error: unknown) => {
      assert.ok(error instanceof AssemblyError);
      assert.equal(error.diagnostic.code, code);
      assert.equal(error.diagnostic.line, line);
      assert.equal(error.diagnostic.column, column);
      assert.match(error.message, new RegExp(`Строка ${line}, позиция ${column}:`));
      return true;
    });
  });
}

test('1024 инструкции разрешены, 1025-я отвергается с номером строки', () => {
  const source = Array.from({ length: 1024 }, (_, i) => i === 1023 ? 'last: HALT' : 'JMP last').join('\n');
  const result = assemble(source);
  assert.equal(result.image.instructions.length, 1024);
  assert.equal(result.image.instructions[0], 0x200003ff);
  assert.equal(result.labels.get('last'), 1023);
  assert.throws(() => assemble(source + '\nHALT'), (error: unknown) => error instanceof AssemblyError
    && error.diagnostic.code === 'PROGRAM_TOO_LARGE' && error.diagnostic.line === 1025);
});

test('имена свойств прототипа допустимы как обычные метки', () => {
  assert.deepEqual(assemble('JMP __proto__\nconstructor: HALT\n__proto__: JMP constructor').image.instructions, [0x20000002, 0, 0x20000001]);
});

test('ошибка сборки не изменяет уже работающий CPU', () => {
  const cpu = new Cpu(assemble('MOV R0, 5\nHALT').image);
  cpu.step();
  const before = cpu.snapshot();
  assert.throws(() => assemble('MOV R0, 2\nJMP missing'), AssemblyError);
  assert.deepEqual(cpu.snapshot(), before);
});

test('ассемблерный пример исполняет цикл через машинную память CPU', () => {
  const result = assemble(readFileSync('examples/assembly/countdown.asm', 'utf8'));
  assert.deepEqual(result.image.instructions, [0x01010000, 0x01110003, 0x01210001, 0x10001000, 0x12112000, 0x22000003, 0x03020300, 0]);
  const cpu = new Cpu(result.image);
  const execution = run(cpu, 100);
  assert.equal(execution.reason, 'halted');
  assert.equal(execution.executedSteps, 14);
  assert.equal(cpu.readData(0x300), 6);
});

test('листинги массивов собираются с контрольными адресами и кодами переходов', () => {
  const document = readFileSync('docs/architecture/programs.md', 'utf8');
  const listings = [...document.matchAll(/```asm\n([\s\S]*?)```/g)].map(match => match[1]!);
  assert.equal(listings.length, 2);
  const sum = assemble(listings[0]!);
  const dot = assemble(listings[1]!);
  assert.equal(sum.image.instructions.length, 18);
  assert.deepEqual([...sum.labels], [['loop', 8], ['done', 15]]);
  assert.equal(sum.image.instructions[7], 0x2100000f);
  assert.equal(sum.image.instructions[14], 0x22000008);
  assert.equal(dot.image.instructions.length, 34);
  assert.deepEqual([...dot.labels], [['loop', 14], ['invalid_length', 31]]);
  assert.equal(dot.image.instructions[8], 0x2200001f);
  assert.equal(dot.image.instructions[11], 0x2200001f);
  assert.equal(dot.image.instructions[25], 0x2200000e);
});
