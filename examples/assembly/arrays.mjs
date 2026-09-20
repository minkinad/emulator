import { readFileSync, writeFileSync } from 'node:fs';
import { assemble } from '../../dist/assembler/index.js';
import { Cpu, decode, hex, run } from '../../dist/core/index.js';
import { ARRAY_EXAMPLES } from '../../dist/programs/catalog.js';
import { signedResult } from '../../dist/programs/result.js';
import { parseInitialData } from '../../dist/ui/model/data.js';

for (const [index, example] of ARRAY_EXAMPLES.entries()) {
  const name = index === 0 ? 'sum' : 'dot';
  const source = readFileSync(new URL(`./${name}.asm`, import.meta.url), 'utf8');
  const { image } = assemble(source);
  const listing = image.instructions.map((word, address) => `${hex(address)}  ${hex(word, 8)}  ${decode(word).assembly}`).join('\n') + '\n';
  if (process.argv.includes('--write-listings')) writeFileSync(new URL(`../machine/${name}.txt`, import.meta.url), listing);
  console.log(`${example.name}\n${listing}`);
  const cpu = new Cpu({ ...image, data: parseInitialData(example.data) });
  const execution = run(cpu, 1000);
  const words = Array.from({ length: example.resultWords }, (_, i) => cpu.readData(0x300 + i));
  const value = signedResult(words);
  const expected = index === 0 ? -5n : 10737418240n;
  if (execution.reason !== 'halted' || value !== expected || (index === 1 && cpu.readData(0x303) !== 0)) {
    throw new Error(`Неверный результат ${name}: ${value}; ожидалось ${expected}.`);
  }
  console.log(`Результат: ${value}; слова: ${words.map(word => hex(word)).join(' ')}; команд: ${execution.executedSteps}.\n`);
}
