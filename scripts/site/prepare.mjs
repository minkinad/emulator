import { cpSync, rmSync } from 'node:fs';

const target = new URL('../../website/.vitepress/dist/app/', import.meta.url);
rmSync(target, { recursive: true, force: true });
cpSync(new URL('../../dist/app/', import.meta.url), target, { recursive: true });
console.log('Приложение добавлено в артефакт GitHub Pages: /emulator/app/');
