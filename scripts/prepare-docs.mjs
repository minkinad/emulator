import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const repository = 'https://github.com/minkinad/emulator/blob/main/';

export const pages = [
  { source: 'README.md', target: 'guide/overview.md', title: 'Задание и архитектура' },
  { source: 'docs/variants.md', target: 'guide/variants.md', title: 'Сравнение вариантов' },
  { source: 'docs/implementation.md', target: 'project/implementation.md', title: 'Этапы реализации' },
  { source: 'docs/publishing.md', target: 'project/publishing.md', title: 'Публикация сайта' },
  { source: '.github/CONTRIBUTING.md', target: 'project/contributing.md', title: 'Работа в команде' },
  { source: 'AGENTS.md', target: 'project/agents.md', title: 'Инструкции для агентов' },
  { source: 'CHANGELOG.md', target: 'project/changelog.md', title: 'История изменений' },
];

export const sources = pages.map(({ source }) => resolve(root, source));

export function prepareDocs() {
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
