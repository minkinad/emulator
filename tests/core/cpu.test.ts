import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Cpu, encode, MACHINE, run } from '../../src/core/index.js';
import type { Instruction, ProgramImage } from '../../src/core/index.js';

const mov = (d: number, value: number): Instruction => ({ op: 'MOV', d, mode: 'immediate', value });
const image = (instructions: readonly number[], data: ProgramImage['data'] = []): ProgramImage => ({ instructions, data, entryPoint: 0 });
const program = (...instructions: Instruction[]) => new Cpu(image(instructions.map(encode)));

test('ручная машинная программа проходит выборку → декодирование → четыре шага', () => {
  const cpu = new Cpu(image([0x01110002, 0x01210003, 0x10012000, 0]));
  assert.equal(cpu.snapshot().instructionAddress, null);
  assert.equal(cpu.snapshot().decoded, null);
  assert.equal(cpu.step().state.registers[1], 2);
  cpu.step();
  const third = cpu.step();
  assert.equal(third.executed, true);
  assert.equal(third.state.pc, 3);
  assert.equal(third.state.instructionAddress, 2);
  assert.equal(third.state.ir, 0x10012000);
  assert.equal(third.state.decoded?.assembly, 'ADD R0, R1, R2');
  assert.equal(third.state.registers[0], 5);
  assert.deepEqual(third.writes, [{ kind: 'register', address: 0, before: 0, after: 5 }]);
  const fourth = cpu.step();
  assert.equal(fourth.state.status, 'halted');
  assert.equal(fourth.state.pc, 4);
  assert.equal(fourth.state.steps, 4);
  assert.equal(fourth.state.ir, 0);
  assert.deepEqual(fourth.state.flags, { zf: false, nf: false, cf: false, of: false });
  assert.deepEqual(cpu.step(), { executed: false, state: fourth.state, writes: [] });
});

test('ручная программа обрабатывает массив циклом внутри CPU', () => {
  const cpu = new Cpu(image([
    0x01010000, 0x01310003, 0x01410100, 0x01b10001,
    0x02630004, 0x10006000, 0x1044b000, 0x1233b000, 0x22000004,
    0x03020300, 0,
  ], [{ address: 0x100, value: 1 }, { address: 0x101, value: 2 }, { address: 0x102, value: 3 }]));
  const result = run(cpu);
  assert.equal(result.reason, 'halted');
  assert.equal(result.executedSteps, 21);
  assert.equal(cpu.readData(0x300), 6);
  assert.equal(result.state.registers[3], 0);
  assert.equal(result.state.registers[4], 0x103);
});

test('адресация и две памяти независимы, включая крайние адреса', () => {
  const cpu = program(
    mov(15, 0xffff), { op: 'MOV', d: 0, mode: 'register', value: 15 },
    { op: 'ST', d: 0, mode: 'direct', value: 0 },
    { op: 'LD', d: 1, mode: 'direct', value: 0 },
    mov(2, 4095), { op: 'ST', d: 1, mode: 'indirect', value: 2 },
    { op: 'LD', d: 2, mode: 'indirect', value: 2 }, { op: 'HALT' },
  );
  const result = run(cpu);
  assert.equal(result.reason, 'halted');
  assert.equal(cpu.readData(0), 0xffff);
  assert.equal(cpu.readData(4095), 0xffff);
  assert.equal(cpu.readInstruction(0), 0x01f1ffff);
  assert.equal(cpu.readInstruction(1023), 0);
  assert.equal(result.state.registers[2], 0xffff);
  assert.equal(result.state.registers[15], 0xffff);
  for (const bad of [-1, 4096, 65535, NaN, 1.5]) assert.throws(() => cpu.readData(bad), { code: 'DATA_OUT_OF_BOUNDS' });
  for (const bad of [-1, 1024, Infinity, 0.5]) assert.throws(() => cpu.readInstruction(bad), { code: 'FETCH_OUT_OF_BOUNDS' });
});

test('трёхадресные операции читают оба источника до записи, CMP не меняет РОН', () => {
  const cpu = program(mov(0, 3), mov(1, 5),
    { op: 'SUB', d: 1, a: 0, b: 1 }, // получатель совпадает со вторым источником
    { op: 'ADD', d: 0, a: 0, b: 0 }, // все три поля совпадают
    { op: 'CMP', a: 0, b: 1 }, { op: 'HALT' });
  run(cpu, 4);
  const before = cpu.snapshot();
  assert.equal(before.registers[0], 6);
  assert.equal(before.registers[1], 0xfffe);
  const compared = cpu.step();
  assert.deepEqual(compared.state.registers, before.registers);
  assert.deepEqual(compared.writes, []);
  assert.equal(compared.state.flags.cf, true);
});

test('перенос проходит через три слова и пересылки сохраняют флаги', () => {
  const cpu = program(mov(0, 0xffff), mov(1, 0xffff), mov(2, 0), mov(3, 1),
    { op: 'ADD', d: 0, a: 0, b: 3 },
    { op: 'MOV', d: 4, mode: 'register', value: 0 },
    { op: 'ST', d: 4, mode: 'direct', value: 0 },
    { op: 'LD', d: 5, mode: 'direct', value: 0 },
    { op: 'ADC', d: 1, a: 1, b: 4 },
    { op: 'ADC', d: 2, a: 2, b: 4 }, { op: 'HALT' });
  run(cpu, 5);
  const flags = cpu.snapshot().flags;
  assert.equal(flags.cf, true);
  for (let i = 0; i < 3; i++) assert.deepEqual(cpu.step().state.flags, flags);
  assert.deepEqual(run(cpu).state.registers.slice(0, 3), [0, 0, 1]);
});

test('умножение и знаковое расширение дают отрицательный 48-битный результат', () => {
  const cpu = program(mov(6, 0x8000), mov(7, 0x7fff),
    { op: 'MULLO', d: 8, a: 6, b: 7 }, { op: 'MULHI', d: 9, a: 6, b: 7 },
    { op: 'SAR', d: 10, a: 9, shift: 15 },
    { op: 'ADD', d: 0, a: 0, b: 8 }, { op: 'ADC', d: 1, a: 1, b: 9 },
    { op: 'ADC', d: 2, a: 2, b: 10 }, { op: 'HALT' });
  const state = run(cpu).state;
  assert.deepEqual(state.registers.slice(0, 3), [0x8000, 0xc000, 0xffff]);
  assert.deepEqual(state.registers.slice(6, 8), [0x8000, 0x7fff]);
});

for (const op of ['JZ', 'JNZ'] as const) {
  for (const equal of [true, false]) {
    test(`${op}: ${equal ? 'нулевой' : 'ненулевой'} результат сравнения`, () => {
      const cpu = program(mov(0, 0), mov(1, equal ? 0 : 1), { op: 'CMP', a: 0, b: 1 },
        { op, target: 5 }, mov(2, 99), { op: 'HALT' });
      run(cpu, 3);
      const flags = cpu.snapshot().flags;
      const branch = cpu.step();
      const taken = (op === 'JZ') === equal;
      assert.equal(branch.state.pc, taken ? 5 : 4);
      assert.deepEqual(branch.state.flags, flags);
      assert.equal(run(cpu).state.registers[2], taken ? 0 : 99);
    });
  }
}

test('ошибочный косвенный адрес не обрезается и не оставляет частичных записей', () => {
  for (const op of ['LD', 'ST'] as const) {
    for (const address of [4096, 65535]) {
      const cpu = program(mov(0, 123), mov(1, address), { op: 'CMP', a: 0, b: 1 },
        { op, d: 0, mode: 'indirect', value: 1 });
      run(cpu, 3);
      const before = cpu.snapshot();
      const memory = cpu.memory();
      const result = cpu.step();
      assert.equal(result.executed, false);
      assert.equal(result.state.status, 'faulted');
      assert.equal(result.state.fault?.code, 'DATA_OUT_OF_BOUNDS');
      assert.equal(result.state.fault?.address, 3);
      assert.equal(result.state.fault?.word, cpu.readInstruction(3));
      assert.equal(result.state.pc, before.pc);
      assert.equal(result.state.steps, before.steps);
      assert.deepEqual(result.state.registers, before.registers);
      assert.deepEqual(result.state.flags, before.flags);
      assert.deepEqual(cpu.memory(), memory);
      assert.deepEqual(result.writes, []);
      assert.deepEqual(cpu.step(), result);
    }
  }
});

test('ошибка декодирования обновляет IR, но сохраняет PC, регистры и флаги', () => {
  for (const word of [0xff000000, 0x10012001, 0x21000400]) {
    const cpu = new Cpu(image([0x01110002, word]));
    const before = cpu.step().state;
    const state = cpu.step().state;
    assert.equal(state.ir, word);
    assert.equal(state.instructionAddress, 1);
    assert.equal(state.decoded, null);
    assert.equal(state.status, 'faulted');
    assert.equal(state.pc, before.pc);
    assert.equal(state.steps, 1);
    assert.deepEqual(state.registers, before.registers);
    assert.deepEqual(state.flags, before.flags);
  }
});

test('отсутствие HALT и переход в незагруженную ячейку обнаруживаются при выборке', () => {
  for (const instruction of [0x01110002, 0x200003ff]) {
    const cpu = new Cpu(image([instruction]));
    const previous = cpu.step().state;
    const state = cpu.step().state;
    assert.equal(state.fault?.code, 'FETCH_OUT_OF_BOUNDS');
    assert.equal(state.fault?.address, previous.pc);
    assert.equal(state.fault?.word, undefined);
    assert.equal(state.ir, previous.ir);
    assert.equal(state.instructionAddress, previous.instructionAddress);
    assert.deepEqual(state.decoded, previous.decoded);
    assert.equal(state.steps, 1);
  }
  const empty = new Cpu();
  assert.equal(empty.step().state.fault?.code, 'FETCH_OUT_OF_BOUNDS');
  assert.equal(empty.snapshot().instructionAddress, null);
});

test('последняя физическая команда может увеличить PC до 1024', () => {
  for (const last of [0, 0x01010001]) {
    const instructions = new Array<number>(MACHINE.codeSize).fill(0);
    instructions[1023] = last;
    const cpu = new Cpu({ ...image(instructions), entryPoint: 1023 });
    const state = cpu.step().state;
    assert.equal(state.pc, 1024);
    assert.equal(state.steps, 1);
    if (last === 0) assert.equal(cpu.step().state.status, 'halted');
    else assert.equal(cpu.step().state.fault?.code, 'FETCH_OUT_OF_BOUNDS');
  }
});

test('неверный образ отвергается целиком и не заменяет образ для сброса', () => {
  const good = image([0x01110002, 0], [{ address: 4095, value: 42 }]);
  const cpu = new Cpu(good);
  cpu.step();
  const before = cpu.snapshot();
  const memory = cpu.memory();
  const invalid: unknown[] = [null, {}, { ...good, instructions: [] },
    { ...good, instructions: new Array(1025).fill(0) }, { ...good, instructions: [2 ** 32] },
    { ...good, instructions: [-1] }, { ...good, instructions: [NaN] },
    { ...good, instructions: [0.5] }, { ...good, instructions: new Array(1) },
    { ...good, entryPoint: 2 }, { ...good, entryPoint: -1 }, { ...good, entryPoint: 0.5 },
    { ...good, data: null }, { ...good, data: [null] },
    { ...good, data: [{ address: 4096, value: 0 }] },
    { ...good, data: [{ address: 0, value: 65536 }] },
    { ...good, data: [{ address: 0, value: -1 }] },
    { ...good, data: [{ address: 0, value: Infinity }] },
    { ...good, data: [{ address: 0, value: 1 }, { address: 0, value: 2 }] }];
  for (const bad of invalid) {
    assert.throws(() => cpu.load(bad), { code: 'INVALID_IMAGE' });
    assert.deepEqual(cpu.snapshot(), before);
    assert.deepEqual(cpu.memory(), memory);
  }
  cpu.reset();
  assert.equal(cpu.readData(4095), 42);
  assert.equal(cpu.snapshot().pc, 0);
  assert.equal(cpu.snapshot().steps, 0);
});

test('снимки, копии памяти и исходный образ не дают менять внутреннее состояние', () => {
  const original = { instructions: [0x01110002, 0], entryPoint: 0, data: [{ address: 0, value: 7 }] };
  const cpu = new Cpu(original);
  const snapshot = cpu.step().state;
  (snapshot.registers as number[])[1] = 999;
  (snapshot.flags as { cf: boolean }).cf = true;
  (snapshot.decoded!.fields as Record<string, number>).OP = 0;
  (snapshot.decoded!.instruction as { op: string }).op = 'HALT';
  const memory = cpu.memory();
  memory.instructions[0] = 0;
  memory.data[0] = 999;
  original.instructions[0] = 0;
  original.data[0]!.value = 999;
  assert.equal(cpu.snapshot().registers[1], 2);
  assert.equal(cpu.snapshot().flags.cf, false);
  assert.equal(cpu.snapshot().decoded?.instruction.op, 'MOV');
  assert.equal(cpu.snapshot().decoded?.fields.OP, 1);
  assert.equal(cpu.readData(0), 7);
  cpu.reset();
  assert.equal(cpu.readInstruction(0), 0x01110002);
  assert.equal(cpu.readData(0), 7);
  assert.equal(cpu.snapshot().instructionAddress, null);
});

test('сброс восстанавливает изменённую память и снимает остановку/ошибку', () => {
  const cpu = new Cpu(image([0x01010063, 0x03020000, 0], [{ address: 0, value: 5 }]));
  run(cpu);
  assert.equal(cpu.readData(0), 99);
  assert.equal(cpu.reset().status, 'ready');
  assert.equal(cpu.readData(0), 5);
  cpu.load(image([0xff000000]));
  cpu.step();
  assert.equal(cpu.reset().fault, null);
  assert.equal(cpu.snapshot().status, 'ready');
  cpu.load(image([0]));
  assert.equal(cpu.readData(0), 0);
  assert.ok(cpu.snapshot().registers.every(value => value === 0));
});

test('лимит останавливает цикл без ошибки CPU, следующий запуск продолжает счётчик', () => {
  const cpu = new Cpu(image([0x20000000]));
  const first = run(cpu, 10);
  assert.equal(first.reason, 'limit');
  assert.equal(first.executedSteps, 10);
  assert.equal(first.state.status, 'ready');
  assert.equal(first.state.fault, null);
  assert.equal(run(cpu, 5).state.steps, 15);
  for (const limit of [0, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => run(cpu, limit), { code: 'INVALID_STEP_LIMIT' });
  }
  assert.equal(run(new Cpu(image([0])), 1).reason, 'halted');
  assert.equal(run(new Cpu(image([0xff000000])), 1).reason, 'faulted');
  const stopped = new Cpu(image([0]));
  run(stopped);
  assert.equal(run(stopped).executedSteps, 0);
});

test('пошаговое и ограниченное выполнение дают одинаковую машину', () => {
  const input = image([0x01110002, 0x01210003, 0x10012000, 0x03020300, 0]);
  const manual = new Cpu(input);
  const continuous = new Cpu(input);
  for (let n = 0; n < input.instructions.length; n++) manual.step();
  run(continuous);
  assert.deepEqual(manual.snapshot(), continuous.snapshot());
  assert.deepEqual(manual.memory(), continuous.memory());
});
