import { readFileSync } from 'node:fs';
import { assemble } from '../../dist/assembler/index.js';
import { Cpu, decode, hex, run } from '../../dist/core/index.js';

const source = readFileSync(new URL('./countdown.asm', import.meta.url), 'utf8');
const assembled = assemble(source);
for (const { address, line } of assembled.sourceMap) {
  const word = assembled.image.instructions[address];
  console.log(`${hex(address)}  ${hex(word, 8)}  ${decode(word).assembly}  (строка ${line})`);
}
const cpu = new Cpu(assembled.image);
const result = run(cpu, 100);
if (result.reason !== 'halted' || cpu.readData(0x300) !== 6) throw new Error('Программа не завершилась с ожидаемой суммой 6.');
console.log(`Результат: ${cpu.readData(0x300)}. Выполнено команд: ${result.executedSteps}.`);
