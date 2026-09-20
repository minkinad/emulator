import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assemble } from '../../src/assembler/index.js';
import { Cpu, decode, hex, run } from '../../src/core/index.js';
import { SUM_SOURCE, DOT_SOURCE } from '../../src/programs/sources.generated.js';
import { signedResult } from '../../src/programs/result.js';

const sumImage = assemble(SUM_SOURCE).image;
const dotImage = assemble(DOT_SOURCE).image;
const mixed = [1, -2, 3, -4, 5, -6, 7, -8, 9, -10];
const mixedB = [10, 9, -8, -7, 6, 5, -4, -3, 2, 1];
const fill = (value: number, count = 10) => Array<number>(count).fill(value);
const sumReference = (a: readonly number[]) => a.reduce((s, x) => s + BigInt(x), 0n);
const dotReference = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + BigInt(x) * BigInt(b[i]!), 0n);
function data(a: readonly number[], b: readonly number[] = [], lengthA = a.length, lengthB = b.length) {
  return [
    { address: 0x100, value: lengthA }, { address: 0x200, value: lengthB },
    ...a.map((value, i) => ({ address: 0x101 + i, value: (value + 65536) % 65536 })),
    ...b.map((value, i) => ({ address: 0x201 + i, value: (value + 65536) % 65536 })),
    ...[0x1234, 0xabcd, 0x5678, 0xffff].map((value, i) => ({ address: 0x300 + i, value })),
    { address: 0xfff, value: 0xbeef },
  ];
}
function assertWords(words: readonly number[], expected: bigint) {
  // Независимый эталон — целое математическое значение, не функции АЛУ или декодера результата.
  const modulus = 1n << BigInt(words.length * 16);
  let encoded = (expected + modulus) % modulus;
  for (const word of words) { assert.equal(word, Number(encoded % 65536n)); encoded /= 65536n; }
  assert.equal(encoded, 0n);
}
function verify(a: readonly number[], b?: readonly number[]) {
  const dot = b !== undefined;
  const cpu = new Cpu({ ...(dot ? dotImage : sumImage), data: data(a, b) });
  const original = cpu.memory();
  const execution = run(cpu, 1000);
  assert.equal(execution.reason, 'halted');
  assert.equal(execution.executedSteps, dot ? 139 : 11 + 7 * a.length);
  const expected = dot ? dotReference(a, b) : sumReference(a);
  const result = Array.from({ length: dot ? 3 : 2 }, (_, i) => cpu.readData(0x300 + i));
  assertWords(result, expected);
  assertWords(execution.state.registers.slice(0, dot ? 3 : 2), expected);
  assert.equal(execution.state.pc, dot ? 31 : 18);
  assert.equal(execution.state.registers[3], 0);
  assert.equal(execution.state.registers[4], 0x101 + a.length);
  if (dot) { assert.equal(execution.state.registers[5], 0x20b); assert.equal(cpu.readData(0x303), 0); }
  else { assert.equal(cpu.readData(0x302), 0x5678); assert.equal(cpu.readData(0x303), 0xffff); }
  assert.deepEqual(cpu.memory().instructions, original.instructions);
  for (let address = 0; address < original.data.length; address++) {
    if (address >= 0x300 && address < (dot ? 0x304 : 0x302)) continue;
    assert.equal(cpu.readData(address), original.data[address], `Запись за пределами результата: ${address}`);
  }
  cpu.reset(); assert.deepEqual(cpu.memory(), original); assert.equal(cpu.snapshot().steps, 0);
  assert.deepEqual(run(cpu, 1000).state, execution.state);
  return result;
}

for (const length of [0, 1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
  test(`сумма: длина ${length}, отрицательные и положительные границы`, () => {
    verify(fill(-32768, length)); verify(fill(32767, length));
    verify(Array.from({ length }, (_, i) => i % 2 ? -32768 : 32767));
  });
}
test('сумма: смешанные знаки и перенос между словами', () => {
  assert.deepEqual(verify(mixed), [0xfffb, 0xffff]);
  verify([-1, 1, 32767, 32767, 2, -32768]);
  verify(fill(0));
});
for (const [name, a, b] of [
  ['смешанные знаки', mixed, mixedB], ['нулевые массивы', fill(0), fill(0)],
  ['положительный результат', fill(1), fill(1)], ['отрицательный результат', fill(-1), fill(1)],
  ['максимум', fill(-32768), fill(-32768)], ['минимум', fill(-32768), fill(32767)],
  ['переносы младшего слова', fill(32767), fill(32767)],
  ['перенос через два слова', [-1, 1, ...fill(0, 8)], fill(1)],
] as const) test(`свёртка: ${name}`, () => { verify(a, b); });

test('детерминированные случайные наборы сверяются с bigint-эталоном', () => {
  let seed = 0x71a2;
  const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed & 0xffff) - 32768; };
  for (let i = 0; i < 64; i++) {
    verify(Array.from({ length: i % 16 }, next));
    verify(Array.from({ length: 10 }, next), Array.from({ length: 10 }, next));
  }
});

for (const [lengthA, lengthB] of [[9, 10], [10, 9], [0, 0], [10, 0], [11, 10], [10, 11], [65535, 10], [10, 65535]]) {
  test(`свёртка: неверные длины ${lengthA}, ${lengthB} сохраняют результат`, () => {
    const cpu = new Cpu({ ...dotImage, data: data(fill(-32768), fill(32767), lengthA, lengthB) });
    const initial = cpu.memory(); const visited: number[] = [];
    while (cpu.snapshot().status === 'ready' && visited.length < 20) {
      const result = cpu.step(); visited.push(result.state.instructionAddress!);
      assert.ok(result.writes.every(write => write.kind !== 'data' || write.address === 0x303));
    }
    assert.equal(cpu.snapshot().status, 'halted'); assert.equal(cpu.snapshot().pc, 34);
    assert.equal(cpu.snapshot().steps, lengthA === 10 ? 15 : 12);
    assert.equal(cpu.readData(0x303), 1); assert.ok(!visited.includes(14));
    initial.data[0x303] = 1; assert.deepEqual(cpu.memory(), initial);
  });
}

test('каждая итерация суммы сохраняет математическую частичную сумму', () => {
  const a = [-1, 1, -32768, -32768, 32767, 32767, 2];
  const cpu = new Cpu({ ...sumImage, data: data(a) }); let iteration = 0;
  for (let step = 0; step < 200 && cpu.snapshot().status === 'ready'; step++) {
    const result = cpu.step();
    if (result.state.instructionAddress === 11) {
      iteration++;
      assertWords(result.state.registers.slice(0, 2), sumReference(a.slice(0, iteration)));
    }
  }
  assert.equal(iteration, a.length); assert.equal(cpu.snapshot().status, 'halted');
});

test('свёртка: знак произведения, частичные суммы и два последовательных переноса', () => {
  const a = [-1, 1, -32768, 32767, -32768, -1, 2, -2, 0, 1];
  const b = [1, 1, -32768, 32767, 32767, -1, -2, 2, 0, -1];
  const cpu = new Cpu({ ...dotImage, data: data(a, b) });
  let iteration = 0; let lowCarry = false; let middleCarry = false;
  for (let step = 0; step < 200 && cpu.snapshot().status === 'ready'; step++) {
    const result = cpu.step(); const state = result.state;
    if (state.instructionAddress === 18) {
      const product = BigInt(a[iteration]!) * BigInt(b[iteration]!);
      assertWords(state.registers.slice(8, 10), product);
      assert.equal(state.registers[10], product < 0n ? 65535 : 0);
    }
    if (iteration === 1 && state.instructionAddress === 19) lowCarry = state.flags.cf;
    if (iteration === 1 && state.instructionAddress === 20) middleCarry = state.flags.cf;
    if (state.instructionAddress === 21) {
      iteration++;
      assertWords(state.registers.slice(0, 3), dotReference(a.slice(0, iteration), b.slice(0, iteration)));
    }
  }
  assert.equal(iteration, 10); assert.equal(lowCarry, true); assert.equal(middleCarry, true);
  assert.equal(cpu.snapshot().status, 'halted');
});

test('лимит внутри цепочки ADC и продолжение сохраняют результат', () => {
  const cpu = new Cpu({ ...dotImage, data: data(fill(-1), fill(1)) });
  const stopped = run(cpu, 20); assert.equal(stopped.reason, 'limit'); assert.equal(stopped.state.pc, 20);
  assert.equal(run(cpu, 200).reason, 'halted');
  assertWords([cpu.readData(0x300), cpu.readData(0x301), cpu.readData(0x302)], -10n);
});

test('ASM, модуль для браузера, документация и машинные листинги согласованы', () => {
  const docs = [...readFileSync('docs/architecture/programs.md', 'utf8').matchAll(/```asm\n([\s\S]*?)```/g)];
  for (const [i, name] of ['sum', 'dot'].entries()) {
    const source = readFileSync(`examples/assembly/${name}.asm`, 'utf8');
    assert.equal(source, i === 0 ? SUM_SOURCE : DOT_SOURCE, 'Выполните npm run programs:prepare');
    assert.equal(docs[i]?.[1], source);
    const listing = assemble(source).image.instructions.map((word, address) => `${hex(address)}  ${hex(word, 8)}  ${decode(word).assembly}`).join('\n') + '\n';
    assert.equal(readFileSync(`examples/machine/${name}.txt`, 'utf8'), listing);
  }
});

test('отображение готового результата учитывает знак и порядок слов', () => {
  assert.equal(signedResult([0xfffb, 0xffff]), -5n);
  assert.equal(signedResult([0, 0x8000, 2]), 10737418240n);
  assert.equal(signedResult([0, 0x8005, 0xfffd]), -10737090560n);
  assert.equal(signedResult([0xffff, 0xffff, 0x7fff]), (1n << 47n) - 1n);
  assert.equal(signedResult([0, 0, 0x8000]), -(1n << 47n));
  for (const words of [[0], [0, -1], [0, 65536], [0, NaN], [0, 1.5]]) assert.throws(() => signedResult(words));
});
