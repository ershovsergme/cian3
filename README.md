# cian3 · Рабочее место дизайнера Циана

Приватный учебный репозиторий для практики «Три репозитория».

```sh
# Node.js 24; при наличии nvm: nvm use
npm ci
npm run dev
```

Маршруты: `/` → `/search` → `/listing/1`; `/ui`, `/patterns`, `/guide`.

[Короткая ипотечная анкета](docs/mortgage-short-form.md): `/mortgage` → калькулятор → три шага → результат. Вход также есть из карточки квартиры.

Начните с [первого прототипа](docs/first-prototype.md), [архитектуры](docs/prototyping.md), [референсов](docs/references/README.md) и [скилла cian-design](.agents/skills/cian-design/SKILL.md).

Задачи практики — [tasks/](tasks/README.md), участники — [team/](team/README.md): у каждого свой файл `team/<github-логин>.md`. Свою работу ведите в ветке `<github-логин>/<задача>`.

React + TypeScript + CSS Modules + Vite. Всё необходимое для демонстрации работает локально. Зависимости закреплены, шрифты и UI-материалы хранятся в репозитории.

[Устройство, команды и API компонентов](docs/README.md).

Перед коммитом: `npm run typecheck && npm run lint && npm test && npm run build`.

Исходный UI-kit извлечён из публичного сайта Циана 12.11.2026. Это учебная адаптация, не официальный полный npm-пакет. Происхождение и ограничения перечислены в документации.

[Результаты проверки и скриншоты](docs/qa/README.md).
