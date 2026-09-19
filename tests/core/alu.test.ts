import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, clearFlags } from '../../src/core/alu.js';
import type { AluOperation } from '../../src/core/isa.js';
import type { Flags } from '../../src/core/index.js';

const flags = (zf: boolean, nf: boolean, cf: boolean, of: boolean): Flags => ({ zf, nf, cf, of });
const cases: [AluOperation, number, number, boolean, number, Flags][] = [
  ['ADD', 0xffff, 1, false, 0, flags(true, false, true, false)],
  ['ADD', 0x7fff, 1, false, 0x8000, flags(false, true, false, true)],
  ['ADD', 0x8000, 0x8000, false, 0, flags(true, false, true, true)],
  ['ADD', 0, 0, true, 0, flags(true, false, false, false)],
  ['ADC', 0xffff, 0, true, 0, flags(true, false, true, false)],
  ['ADC', 0x7fff, 0, true, 0x8000, flags(false, true, false, true)],
  ['ADC', 0x8000, 0xffff, true, 0x8000, flags(false, true, true, false)],
  ['SUB', 0, 1, false, 0xffff, flags(false, true, true, false)],
  ['SUB', 0x8000, 1, false, 0x7fff, flags(false, false, false, true)],
  ['SUB', 0x7fff, 0xffff, false, 0x8000, flags(false, true, true, true)],
  ['CMP', 7, 7, false, 0, flags(true, false, false, false)],
  ['MULLO', 0x8000, 0x8000, false, 0, flags(true, false, true, true)],
  ['MULHI', 0x8000, 0x8000, false, 0x4000, flags(false, false, true, true)],
  ['MULLO', 0xffff, 1, false, 0xffff, flags(false, true, false, false)],
  ['MULHI', 0xffff, 1, false, 0xffff, flags(false, true, false, false)],
  ['MULLO', 0x8000, 0x7fff, false, 0x8000, flags(false, true, true, true)],
  ['MULHI', 0x8000, 0x7fff, false, 0xc000, flags(false, true, true, true)],
  ['MULHI', 0x8000, 1, false, 0xffff, flags(false, true, false, false)],
  ['SAR', 0x8001, 1, false, 0xc000, flags(false, true, true, false)],
  ['SAR', 0xffff, 15, false, 0xffff, flags(false, true, true, false)],
  ['SAR', 0x8000, 15, true, 0xffff, flags(false, true, false, false)],
  ['SAR', 0x7fff, 15, false, 0, flags(true, false, true, false)],
  ['AND', 0xff00, 0x00ff, true, 0, flags(true, false, false, false)],
  ['OR', 0xf000, 0x0fff, true, 0xffff, flags(false, true, false, false)],
  ['XOR', 0xaaaa, 0xaaaa, true, 0, flags(true, false, false, false)],
];
for (const [op, a, b, cf, value, expected] of cases) {
  test(`${op}: ${a}, ${b}, входной CF=${Number(cf)}`, () => {
    assert.deepEqual(calculate(op, a, b, { zf: true, nf: true, cf, of: true }), { value, flags: expected });
  });
}

test('нулевой SAR сохраняет все флаги даже при другом знаке/нуле результата', () => {
  for (const value of [0, 1, 0x8000, 0xffff]) {
    for (const f of [clearFlags(), flags(true, true, true, true)]) {
      assert.deepEqual(calculate('SAR', value, 0, f), { value, flags: f });
    }
  }
});

test('арифметика сверяется с независимыми bigint-вычислениями на границах и случайных словах', () => {
  let seed = 7;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 16; };
  const pairs: [number, number][] = [];
  for (const a of [0, 1, 0x7fff, 0x8000, 0xfffe, 0xffff]) {
    for (const b of [0, 1, 0x7fff, 0x8000, 0xfffe, 0xffff]) pairs.push([a, b]);
  }
  for (let n = 0; n < 2000; n++) pairs.push([random(), random()]);
  for (const [a, b] of pairs) {
    const sa = BigInt.asIntN(16, BigInt(a));
    const sb = BigInt.asIntN(16, BigInt(b));
    for (const cf of [false, true]) {
      for (const op of ['ADD', 'ADC', 'SUB', 'CMP'] as const) {
        const subtract = op === 'SUB' || op === 'CMP';
        const carry = op === 'ADC' && cf ? 1n : 0n;
        const exact = subtract ? sa - sb : sa + sb + carry;
        const unsigned = subtract ? BigInt(a) - BigInt(b) : BigInt(a) + BigInt(b) + carry;
        const value = Number(BigInt.asUintN(16, exact));
        assert.deepEqual(calculate(op, a, b, { ...clearFlags(), cf }), {
          value,
          flags: flags(value === 0, value >= 32768, subtract ? unsigned < 0n : unsigned > 65535n, BigInt.asIntN(16, exact) !== exact),
        });
      }
    }
    const p = sa * sb;
    const fits = BigInt.asIntN(16, p) === p;
    for (const op of ['MULLO', 'MULHI'] as const) {
      const value = Number(BigInt.asUintN(16, op === 'MULLO' ? p : p >> 16n));
      assert.deepEqual(calculate(op, a, b, clearFlags()), { value, flags: flags(value === 0, value >= 32768, !fits, !fits) });
    }
    for (const shift of [1, 7, 15]) {
      const value = Number(BigInt.asUintN(16, sa >> BigInt(shift)));
      const cf = (BigInt(a) & (1n << BigInt(shift - 1))) !== 0n;
      assert.deepEqual(calculate('SAR', a, shift, clearFlags()), { value, flags: flags(value === 0, value >= 32768, cf, false) });
    }
  }
});
