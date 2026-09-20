import { defineConfig } from 'vitepress';
import { prepareDocs, sources } from '../../scripts/docs/prepare.mjs';

prepareDocs();

export default defineConfig({
  lang: 'ru-RU',
  title: 'Emulator',
  description: 'Учебный процессор: от ассемблерной команды до состояния машины. Спецификация, ассемблер и API.',
  base: '/emulator/',
  cleanUrls: false,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/emulator/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#f5f5f7', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#111113', media: '(prefers-color-scheme: dark)' }],
  ],
  sitemap: { hostname: 'https://minkinad.github.io/emulator/' },
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'emulator',
    nav: [
      { text: 'Эмулятор ↗', link: 'https://minkinad.github.io/emulator/app/' },
      { text: 'Документация', link: '/guide/overview' },
      { text: 'Ассемблер', link: '/guide/assembler' },
      { text: 'Варианты', link: '/guide/variants' },
      { text: 'История', link: '/project/changelog' },
    ],
    sidebar: [
      {
        text: 'Документация',
        items: [
          { text: 'Начало работы', link: '/guide/overview' },
          { text: 'Браузерный эмулятор', link: '/guide/application' },
          { text: 'Спецификация процессора', link: '/guide/architecture' },
          { text: 'Ассемблер', link: '/guide/assembler' },
          { text: 'Использование ядра', link: '/guide/core-api' },
          { text: 'Алгоритмы массивов', link: '/guide/programs' },
          { text: 'Сравнение 16 вариантов', link: '/guide/variants' },
        ],
      },
      {
        text: 'Разработка',
        items: [
          { text: 'Структура проекта', link: '/project/structure' },
          { text: 'План развития', link: '/project/implementation' },
          { text: 'Участие в разработке', link: '/project/contributing' },
          { text: 'Публикация сайта', link: '/project/publishing' },
          { text: 'История изменений', link: '/project/changelog' },
        ],
      },
      {
        text: 'Исходные материалы',
        items: [
          { text: 'Методичка ↗', link: 'https://github.com/minkinad/emulator/blob/main/task/task.md' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/minkinad/emulator' }],
    outline: { label: 'На этой странице', level: [2, 3] },
    docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' },
    editLink: {
      pattern: ({ filePath, frontmatter }) => {
        const source = frontmatter.sourcePath ?? `website/${filePath}`;
        return `https://github.com/minkinad/emulator/edit/main/${source}`;
      },
      text: 'Редактировать на GitHub',
    },
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск по документации' },
              modal: {
                displayDetails: 'Показать подробности',
                resetButtonTitle: 'Очистить поиск',
                backButtonTitle: 'Закрыть поиск',
                noResultsText: 'Ничего не найдено по запросу',
                footer: { selectText: 'выбрать', navigateText: 'перейти', closeText: 'закрыть' },
              },
            },
          },
        },
      },
    },
    darkModeSwitchLabel: 'Цветовая тема',
    lightModeSwitchTitle: 'Светлая тема',
    darkModeSwitchTitle: 'Тёмная тема',
    sidebarMenuLabel: 'Разделы',
    returnToTopLabel: 'Наверх',
    skipToContentLabel: 'К содержимому',
    footer: { message: 'Emulator · Документация', copyright: 'От инструкции — к пониманию архитектуры.' },
  },
  vite: {
    plugins: [{
      name: 'sync-project-documents',
      configureServer(server) {
        server.watcher.add(sources);
        server.watcher.on('change', (file) => {
          if (sources.includes(file)) prepareDocs();
        });
      },
    }],
  },
});
