import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmulatorSession } from '../../src/ui/model/session.js';
import { parseInitialData, DataInputError } from '../../src/ui/model/data.js';
import { EXAMPLES } from '../../src/ui/examples.js';

function fixture(source = 'MOV R0, 7\nST [0x0300], R0\nHALT', data = '') {
  const tasks: { callback: () => void; cancelled: boolean }[] = [];
  const session = new EmulatorSession(source, data, callback => {
    const task = { callback, cancelled: false }; tasks.push(task);
    return () => { task.cancelled = true; };
  });
  const tick = () => { const task = tasks.shift(); assert.ok(task); if (!task.cancelled) task.callback(); };
  return { session, tasks, tick };
}

test('начальные данные: адреса слов, знаковые числа, hex, комментарии и CRLF', () => {
  assert.deepEqual(parseInitialData('; данные\r\n0x100: -32768, +32767, 0xFFFF ; конец\r4095: 0'), [
    { address: 256, value: 32768 }, { address: 257, value: 32767 }, { address: 258, value: 65535 }, { address: 4095, value: 0 },
  ]);
});
for (const data of ['4096: 0', '4095: 0, 1', '0: 32768', '0: -32769', '0: 0x10000', '0: 1,', '0: 1\n0: 2', '0: 1,2\n1: 3', '-1: 0', '0: 1.5', '0: 9007199254740993']) {
  test(`данные отклоняют неверный ввод: ${data}`, () => assert.throws(() => parseInitialData(data), DataInputError));
}

test('снимок стабилен между изменениями, шаг отображает запись и машинную инструкцию', () => {
  const { session } = fixture();
  const initial = session.getSnapshot(); assert.equal(initial, session.getSnapshot());
  session.step(); const next = session.getSnapshot();
  assert.notEqual(initial, next); assert.equal(next.cpu.registers[0], 7);
  assert.equal(next.cpu.pc, 1); assert.equal(next.cpu.instructionAddress, 0);
  assert.deepEqual(next.changedRegisters, [0]); assert.equal(initial.cpu.registers[0], 0);
});

for (const example of EXAMPLES) {
  test(`запуск и шаги дают одинаковое состояние: ${example.id}`, () => {
    const slow = fixture(example.source, example.data);
    const fast = fixture(example.source, example.data);
    for (let n = 0; n < 1000 && slow.session.getSnapshot().cpu.status === 'ready'; n++) slow.session.step();
    fast.session.run('fast'); fast.tick();
    assert.equal(fast.session.getSnapshot().cpu.status, 'halted');
    assert.deepEqual(fast.session.getSnapshot().cpu, slow.session.getSnapshot().cpu);
    assert.deepEqual(fast.session.getSnapshot().memory, slow.session.getSnapshot().memory);
    assert.equal(fast.tasks.length, 0);
  });
}

test('ошибочная сборка сохраняет предыдущую машину, но запрещает исполнение черновика', () => {
  const { session } = fixture(); session.step(); const before = session.getSnapshot();
  session.setDraft('MOV R16, 1', ''); assert.equal(session.build(), false);
  assert.equal(session.getSnapshot().notice?.target, 'source');
  session.step(); session.run('fast');
  assert.deepEqual(session.getSnapshot().cpu, before.cpu);
  assert.equal(session.getSnapshot().assembly, before.assembly);
  session.setDraft('HALT', '0: 99999'); assert.equal(session.build(), false);
  assert.equal(session.getSnapshot().notice?.target, 'data');
  assert.deepEqual(session.getSnapshot().memory, before.memory);
  session.setDraft('HALT', ''); assert.equal(session.build(), true);
  assert.equal(session.getSnapshot().cpu.steps, 0); assert.equal(session.getSnapshot().dirty, false);
});

test('пауза, сброс и изменение исходника отменяют даже устаревший callback', () => {
  for (const action of ['pause', 'reset', 'edit', 'dispose'] as const) {
    const { session, tasks } = fixture('JMP 0'); session.run('fast');
    const stale = tasks[0]!;
    if (action === 'edit') session.setDraft('HALT', '');
    else session[action]();
    assert.equal(stale.cancelled, true); stale.callback();
    assert.equal(session.getSnapshot().cpu.steps, 0);
  }
});

test('лимит приостанавливает цикл точно, продолжение получает новый лимит', () => {
  const { session, tick, tasks } = fixture('JMP 0');
  session.run('fast', 251); session.run('fast', 4); assert.equal(tasks.length, 1);
  tick(); assert.equal(session.getSnapshot().cpu.steps, 250); tick();
  assert.equal(session.getSnapshot().cpu.steps, 251); assert.equal(session.getSnapshot().running, false);
  assert.match(session.getSnapshot().notice!.text, /лимит 251/);
  session.run('fast', 2); tick(); assert.equal(session.getSnapshot().cpu.steps, 253);
});

test('HALT на границе лимита и ошибка памяти завершают запуск', () => {
  const halted = fixture('HALT'); halted.session.run('fast', 1); halted.tick();
  assert.equal(halted.session.getSnapshot().cpu.status, 'halted');
  assert.match(halted.session.getSnapshot().notice!.text, /HALT/);
  const faulted = fixture('MOV R1, 4096\nLD R0, [R1]\nHALT');
  faulted.session.run('fast'); faulted.tick();
  assert.equal(faulted.session.getSnapshot().cpu.status, 'faulted');
  assert.equal(faulted.session.getSnapshot().cpu.steps, 1);
  assert.equal(faulted.session.getSnapshot().running, false);
  assert.equal(faulted.session.getSnapshot().notice?.kind, 'error');
});

test('сброс восстанавливает начальные данные и сохраняет несобранный черновик', () => {
  const { session, tick } = fixture(undefined, '0x0300: -1');
  session.run('fast'); tick(); assert.equal(session.getSnapshot().memory.data[768], 7);
  session.setDraft('HALT', ''); session.reset();
  assert.equal(session.getSnapshot().source, 'HALT'); assert.equal(session.getSnapshot().dirty, true);
  assert.equal(session.getSnapshot().memory.data[768], 65535); assert.equal(session.getSnapshot().cpu.steps, 0);
});

test('подписчик может остановить запуск без появления нового таймера', () => {
  const { session, tasks } = fixture('JMP 0');
  session.subscribe(() => { if (session.getSnapshot().running) session.pause(); });
  session.run('fast'); assert.equal(tasks.length, 0);
});

for (const limit of [0, -1, 1.5, NaN, Infinity, 1000001]) {
  test(`неверный лимит ${limit} не запускает CPU`, () => {
    const { session, tasks } = fixture(); session.run('fast', limit);
    assert.equal(tasks.length, 0); assert.equal(session.getSnapshot().notice?.kind, 'error');
  });
}
