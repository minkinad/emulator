import { Cpu, hex } from '../../dist/core/index.js';

// MOV R1, 2; MOV R2, 3; ADD R0, R1, R2; HALT.
// Слова заданы вручную: ассемблер для запуска не требуется.
const cpu = new Cpu({
  instructions: [0x01110002, 0x01210003, 0x10012000, 0x00000000],
  entryPoint: 0,
  data: [],
});

for (let n = 0; n < 10; n += 1) {
  const { state } = cpu.step();
  console.log(`Шаг ${state.steps}: адрес ${state.instructionAddress}, слово ${hex(state.ir, 8)}, ${state.decoded?.assembly ?? 'ошибка'}`);
  console.log(`  R0=${state.registers[0]}, R1=${state.registers[1]}, R2=${state.registers[2]}, PC=${state.pc}`);
  if (state.status !== 'ready') break;
}
const state = cpu.snapshot();
if (state.status !== 'halted' || state.registers[0] !== 5) {
  throw new Error(`Демонстрация не завершилась ожидаемым результатом: ${state.fault?.message ?? state.status}`);
}
console.log('Процессор остановлен. Результат: 2 + 3 = 5.');
