import { readFileSync, writeFileSync } from 'node:fs';

// ASM — единственный редактируемый источник; модуль нужен и Vite, и Node.js.
const sources = ['sum', 'dot'].map(name => {
  const source = readFileSync(new URL(`../../examples/assembly/${name}.asm`, import.meta.url), 'utf8');
  return `export const ${name.toUpperCase()}_SOURCE = ${JSON.stringify(source)};`;
});
writeFileSync(new URL('../../src/programs/sources.generated.ts', import.meta.url),
  '// Создано scripts/programs/prepare.mjs из examples/assembly/*.asm. Не редактировать вручную.\n' + sources.join('\n') + '\n');
