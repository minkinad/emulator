import { readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, '.test-build');
// Удаляются только результаты компиляции тестов, чтобы перенесённые тесты не запускались повторно.
rmSync(output, { recursive: true, force: true });
function execute(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
execute(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json']);
function tests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? tests(path) : entry.name.endsWith('.test.js') ? [path] : [];
  }).sort();
}
const files = tests(resolve(output, 'tests'));
if (files.length === 0) throw new Error('Не найдено ни одного теста.');
execute(['--test', ...files]);
