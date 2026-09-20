import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const document = readFileSync(new URL('docs/report/report.md', root), 'utf8');
for (const [name, language, path] of [
  ['sum-source', 'asm', 'examples/assembly/sum.asm'],
  ['sum-machine', 'text', 'examples/machine/sum.txt'],
  ['dot-source', 'asm', 'examples/assembly/dot.asm'],
  ['dot-machine', 'text', 'examples/machine/dot.txt'],
]) {
  const expected = `<!-- report:${name}:start -->\n\`\`\`${language}\n${readFileSync(new URL(path, root), 'utf8')}\`\`\`\n<!-- report:${name}:end -->`;
  const start = `<!-- report:${name}:start -->`;
  if (document.split(start).length !== 2 || !document.includes(expected)) {
    throw new Error(`Листинг ${name} в отчёте расходится с ${path}. Обновите полный блок, сохранив маркеры.`);
  }
}
console.log('Отчёт: оба исходника и оба машинных листинга соответствуют файлам репозитория.');
