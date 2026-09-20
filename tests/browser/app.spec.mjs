import { test, expect } from '@playwright/test';

const button = (page, name) => page.getByRole('button', { name, exact: true });
async function runFast(page) {
  await page.getByLabel('Скорость').selectOption('fast');
  await button(page, 'Запуск').click();
  await expect(page.getByTestId('status')).toHaveText('Остановлен');
}

test.beforeEach(async ({ page }) => { await page.goto('./'); });

test('сборка, шаги, машинные поля, результат в памяти и сброс', async ({ page }) => {
  await expect(page.getByTestId('status')).toHaveText('Готов');
  await button(page, 'Шаг').click();
  await expect(page.getByTestId('pc')).toHaveText('0x0001');
  await expect(page.getByTestId('ir')).toHaveText(/[0-9A-F]{8}/);
  await expect(page.getByTestId('current-instruction')).toContainText('MOV R0');
  await expect(page.getByLabel('Поля инструкции')).toBeVisible();
  await button(page, 'Шаг').click();
  await expect(page.getByTestId('register-3').locator('strong')).toHaveText('0003');
  await runFast(page);
  await expect(page.getByTestId('step-count')).toHaveText('14');
  await expect(page.getByTestId('register-0').locator('strong')).toHaveText('0006');
  await button(page, 'Данные').click();
  await expect(page.getByTestId('data-768').locator('strong')).toHaveText('0006');
  await button(page, 'Сброс').click();
  await expect(page.getByTestId('step-count')).toHaveText('0');
  await expect(page.getByTestId('data-768').locator('strong')).toHaveText('0000');
});

test('начальные данные, знаковые числа, ошибки сборки и возврат к строке', async ({ page }) => {
  await page.getByLabel('Пример', { exact: true }).selectOption('memory');
  await button(page, 'Данные').click(); await button(page, 'К данным').click();
  await expect(page.getByTestId('data-256')).toContainText('-7');
  await runFast(page);
  await page.getByRole('textbox', { name: 'Начальные данные', exact: true }).fill('0x0100: -2, 9');
  await expect(button(page, 'Шаг')).toBeDisabled();
  await button(page, 'Собрать').click(); await runFast(page);
  await button(page, 'К результату').click();
  await expect(page.getByTestId('data-768').locator('strong')).toHaveText('0007');
  await page.getByLabel('Исходный код').fill('HALT\nMOV R16, 1');
  await button(page, 'Собрать').click();
  await expect(page.getByRole('alert')).toContainText('2');
  await button(page, 'К ошибке').click();
  await expect(page.getByLabel('Исходный код')).toBeFocused();
  expect(await page.getByLabel('Исходный код').evaluate(el => el.selectionStart)).toBeGreaterThanOrEqual(5);
  await expect(page.getByTestId('data-768').locator('strong')).toHaveText('0007');
});

test('пауза, лимит и ошибка CPU оставляют приложение управляемым', async ({ page }) => {
  await page.getByLabel('Исходный код').fill('JMP 0'); await button(page, 'Собрать').click();
  await button(page, 'Запуск').click();
  await expect(page.getByTestId('step-count')).not.toHaveText('0');
  await button(page, 'Пауза').click();
  const count = await page.getByTestId('step-count').textContent();
  await page.waitForTimeout(220); await expect(page.getByTestId('step-count')).toHaveText(count);
  await button(page, 'Сброс').click();
  await page.getByLabel('Скорость').selectOption('fast'); await page.getByLabel('Лимит команд').fill('5');
  await button(page, 'Запуск').click();
  await expect(page.getByTestId('step-count')).toHaveText('5');
  await expect(page.getByRole('status')).toContainText('лимит 5');
  await page.getByLabel('Исходный код').fill('MOV R1, 4096\nLD R0, [R1]\nHALT');
  await button(page, 'Собрать').click(); await button(page, 'Запуск').click();
  await expect(page.getByTestId('status')).toHaveText('Ошибка CPU');
  await expect(page.getByRole('alert')).toBeVisible(); await expect(button(page, 'Шаг')).toBeDisabled();
  await button(page, 'Сброс').click(); await expect(page.getByTestId('status')).toHaveText('Готов');
});

test('границы двух адресных пространств и связь с редактором', async ({ page }) => {
  await button(page, 'Строка 3').click(); await expect(page.getByLabel('Исходный код')).toBeFocused();
  await page.getByLabel('Адрес просмотра').fill('1023');
  await expect(button(page, 'Следующие ячейки')).toBeDisabled();
  await page.getByLabel('Адрес просмотра').fill('1024');
  await expect(page.getByRole('alert')).toContainText('1023');
  await button(page, 'Данные').click(); await page.getByLabel('Адрес просмотра').fill('4095');
  await expect(page.getByTestId('data-4095')).toBeVisible();
  await expect(button(page, 'Следующие ячейки')).toBeDisabled();
  await page.getByLabel('Адрес просмотра').fill('4096');
  await expect(page.getByRole('alert')).toContainText('4095');
});

for (const width of [320, 390, 1440]) {
  test(`темы и вёрстка при ширине ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await page.reload();
    await button(page, 'Включить тёмную тему').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await button(page, 'Включить светлую тему').click();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await runFast(page); expect(errors).toEqual([]);
  });
}
