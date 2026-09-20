import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const repository = 'https://github.com/minkinad/emulator/blob/main/';

export const pages = [
  { source: 'docs/project/application.md', target: 'guide/application.md', title: 'Браузерный эмулятор' },
  { source: 'README.md', target: 'guide/overview.md', title: 'Начало работы' },
  { source: 'docs/architecture/cpu.md', target: 'guide/architecture.md', title: 'Спецификация процессора' },
  { source: 'docs/architecture/assembler.md', target: 'guide/assembler.md', title: 'Ассемблер' },
  { source: 'docs/architecture/core-api.md', target: 'guide/core-api.md', title: 'Использование ядра' },
  { source: 'docs/project/structure.md', target: 'project/structure.md', title: 'Структура проекта' },
  { source: 'docs/architecture/programs.md', target: 'guide/programs.md', title: 'Алгоритмы массивов' },
  { source: 'docs/reference/variants.md', target: 'guide/variants.md', title: 'Сравнение вариантов' },
  { source: 'docs/project/implementation.md', target: 'project/implementation.md', title: 'План развития' },
  { source: 'docs/project/publishing.md', target: 'project/publishing.md', title: 'Публикация сайта' },
  { source: '.github/CONTRIBUTING.md', target: 'project/contributing.md', title: 'Участие в разработке' },
  { source: 'CHANGELOG.md', target: 'project/changelog.md', title: 'История изменений' },
];

export const sources = pages.map(({ source }) => resolve(root, source));

export function prepareDocs() {
  // Только каталоги генерируемых копий; исходники документов находятся вне них.
  for (const directory of ['guide', 'project']) {
    rmSync(resolve(root, 'website', directory), { recursive: true, force: true });
  }
  for (const page of pages) {
    const source = resolve(root, page.source);
    const content = readFileSync(source, 'utf8').replace(
      /(\[[^\]\n]*\]\()([^\s)]+)(\))/g,
      (match, prefix, href, suffix) => {
        if (/^(?:[a-z]+:|#|\/)/i.test(href)) return match;
        const [pathname, hash] = href.split('#', 2);
        const linkedSource = relative(root, resolve(dirname(source), pathname)).split(sep).join('/');
        const linkedPage = pages.find(({ source }) => source === linkedSource);
        const link = linkedPage
          ? `/${linkedPage.target}`
          : `${repository}${linkedSource.split('/').map(encodeURIComponent).join('/')}`;
        return `${prefix}${link}${hash ? `#${hash}` : ''}${suffix}`;
      },
    );
    const output = resolve(root, 'website', page.target);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `---\ntitle: ${JSON.stringify(page.title)}\nsourcePath: ${JSON.stringify(page.source)}\n---\n\n${content}`);
  }
}
