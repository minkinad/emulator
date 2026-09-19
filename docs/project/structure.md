# Где что лежит

Проект использует один `package.json` и один lock-файл в корне. Команды запускаются из корня; отдельные пакеты и workspace пока не нужны. Код, проверки, примеры и оформление документации находятся в разных каталогах.

```text
emulator/
├── src/
│   └── core/                   # Независимая модель процессора на TypeScript
│       ├── index.ts            # Публичный API
│       ├── isa.ts              # Размеры машины, коды и типы инструкций
│       ├── codec.ts            # Кодирование, декодирование и отображение
│       ├── alu.ts              # Арифметика ограниченной разрядности и флаги
│       ├── cpu.ts              # Состояние, память и один шаг
│       ├── image.ts            # Проверка образа до загрузки
│       ├── run.ts              # Ограниченный запуск для CLI и тестов
│       ├── types.ts            # Образ, снимок, флаги и результат шага
│       └── errors.ts           # Коды ошибок и исключения
├── tests/
│   └── core/                   # Кодек, АЛУ, CPU и короткие машинные программы
├── examples/
│   └── machine/add.mjs         # Запускаемый пример с ручными машинными словами
├── docs/
│   ├── architecture/           # Контракт CPU, API ядра и черновики программ
│   ├── project/                # Этапы, структура и публикация
│   └── reference/              # Сравнение вариантов задания
├── website/                    # Только сайт документации на VitePress
│   ├── index.md                # Главная страница
│   ├── public/                 # Статические файлы сайта
│   └── .vitepress/             # Конфигурация и тема
├── scripts/
│   └── docs/prepare.mjs        # Сборка страниц из исходных Markdown
├── task/                       # Исходная методичка и изображения
├── .github/                    # CI, публикация, шаблоны и правила участия
├── README.md                   # Начальная точка и команды
├── AGENTS.md                   # Инструкции для агентов
├── CHANGELOG.md                # Выполненные изменения
├── package.json                # Единые команды и зависимости
├── package-lock.json           # Точные версии зависимостей
├── tsconfig.json               # Сборка ядра в dist/
└── tsconfig.test.json          # Сборка тестов отдельно от библиотеки
```

## Как выбирать место для изменения

| Изменение | Место |
| --- | --- |
| Новая инструкция или исправление кодирования | `src/core/isa.ts`, `src/core/codec.ts`, [спецификация](../architecture/cpu.md), тесты кодека. |
| Семантика арифметики, переносы и флаги | `src/core/alu.ts`, `tests/core/alu.test.ts`; для поведения шага также `cpu.test.ts`. |
| Загрузка, память, шаг и ошибки CPU | `src/core/cpu.ts`, `src/core/image.ts`, `tests/core/cpu.test.ts`. |
| Общедоступные типы и подключение ядра | `src/core/index.ts`, `src/core/types.ts`, [API](../architecture/core-api.md). |
| Учебный машинный пример | `examples/machine/`; ожидаемый результат проверяется на CPU. |
| Требования к процессору | `docs/architecture/`. |
| Правила работы и эксплуатация проекта | `docs/project/`, корневой AGENTS и `.github/CONTRIBUTING.md`. |
| Оформление сайта | `website/.vitepress/theme/`. |
| Новая страница сайта | Исходный Markdown в `docs/`, запись в `scripts/docs/prepare.mjs`, ссылка в конфигурации VitePress. |

На этапе 4 появятся `src/assembler/` и `tests/assembler/`; на этапе 5 — `src/ui/` и входная точка приложения React + Vite; на этапе 6 — ассемблерные примеры в `examples/assembly/`. Пустые каталоги заранее не создаются. Ядро не импортирует ассемблер, React, DOM, Node.js или файлы сайта; следующие слои используют его публичный API.

## Что генерируется

| Каталог | Источник | В Git |
| --- | --- | --- |
| `dist/` | `npm run build`, исходники `src/` | Нет |
| `.test-build/` | `npm test`, исходники и тесты | Нет |
| `website/guide/`, `website/project/` | `scripts/docs/prepare.mjs`, исходные Markdown | Нет |
| `website/.vitepress/dist/` | `npm run docs:build` | Нет |
| Кэши VitePress и `node_modules/` | Локальная разработка и установка | Нет |

Редактировать нужно исходники. В частности, `docs/project/` — настоящие документы, а `website/project/` — их автоматически созданные копии.

## Перенос существующих файлов

| Раньше | Теперь |
| --- | --- |
| `docs/architecture.md` | [docs/architecture/cpu.md](../architecture/cpu.md) |
| `docs/programs.md` | [docs/architecture/programs.md](../architecture/programs.md) |
| `docs/implementation.md` | [docs/project/implementation.md](implementation.md) |
| `docs/publishing.md` | [docs/project/publishing.md](publishing.md) |
| `docs/variants.md` | [docs/reference/variants.md](../reference/variants.md) |
| `scripts/prepare-docs.mjs` | `scripts/docs/prepare.mjs` |

Адреса уже существовавших страниц сайта сохранены: например, спецификация по-прежнему доступна как `guide/architecture.html`. Меняется расположение исходников и ссылка «Редактировать», а не публичный маршрут. Исходные материалы `task/` остаются на прежнем месте.
