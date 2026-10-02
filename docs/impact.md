# Аналіз впливу — BILL-482

> Task B. Заповнено **до** зміни коду.

## 1. Що саме змінюється

`lib/format.js:formatDate()` зараз повертає дату у форматі `MM/DD/YYYY`
(попри власний docstring, що каже "ISO format" — див. `docs/codebase-map.md`,
перевірка №3). BILL-482 просить, щоб дати, **які бачать клієнти**, стали
`дд.мм.рррр`. `formatDate()` — спільна функція; будь-яка зміна її виводу
б'є по всіх, хто її викликає, включно з тим, хто цього не хотів.

## 2. Хто від цього залежить

| # | Споживач (файл) | Як дістається до зміненої поведінки | Хто читає результат: людина чи інша система | Що з ним має статися після тікета |
|---|---|---|---|---|
| 1 | `lib/invoices/render.js` (`renderInvoiceHtml`, рядки 38-39) — HTML рахунку, віддається через `GET /invoices/:number` (`lib/invoices/routes.js`) і `bin/render-invoice.js` | Прямий виклик `format.formatDate(invoice.issued_at / due_at)` | **Людина** — клієнт, у браузері або роздруківці | **Змінитись.** Це і є дата, яку тікет називає "бачать клієнти" |
| 2 | `lib/notifications/reminders.js` (`body()`, рядки 39-46) — текст нагадування про оплату, пишеться в `out/mail` через `bin/send-reminders.js` (cron 09:00, робочі дні) | Прямий виклик `format.formatDate(invoice.due_at)` | **Людина** — клієнт, лист на email (старий SMTP-релей забирає файли з `out/mail`) | **Змінитись.** Це теж дата, яку бачить клієнт — лист про прострочення/нагадування |
| 3 | `lib/export/accounting.js` (`cell()`, рядок 30) — нічний CSV для бухгалтерії, `bin/nightly-export.js` (cron 02:30) → `out/export/oblik-*.csv` | **Непрямий, динамічний** виклик: `config/export-columns.json` позначає колонки `issued_at`/`due_at` типом `"Date"`, і `cell()` бере функцію як `format['format' + col.type]` — тобто `format['formatDate']`. Текстовий пошук буквального `formatDate(` цей виклик **не знаходить** | **Інша система** — імпорт «Облік-Плюс» забирає файл о 06:00 (`app/docs/integrations/oblik-plus.md`) | **Лишитись як є.** «Облік-Плюс» очікує саме `MM/DD/YYYY` (їхній сервер з американською локаллю) і **мовчки пропускає** рядок з іншим форматом дати — без помилки в нас чи в них. У лютому 2021 так "загубили" 40 рахунків на три тижні. Зміна тут — **не** мета тікета і не узгоджена з бухгалтерією |
| 4 | `test/format.test.js` — наявний (засіяний) тест, що пряма тестує саму `formatDate()` | Прямий виклик функції | — (тест, не продакшн-споживач) | Не досліджувалось окремо в Task B — на момент цього аналізу `test/format.test.js` не містить асертів саме на `formatDate()` (тільки на `formatMoney`/`formatDecimal`/`formatText`/`formatPercent`), тож нема чого оновлювати тут |
| 5 | `test/invoices.test.js` — наявний (засіяний) тест, рядки 41-42: `assert.match(html, /Дата: <b>03\/09\/2026<\/b>/)` тощо | Через `render.renderInvoiceHtml` → `formatDate` | — (тест, дзеркалить споживача №1) | **Очікувано почервоніє** в Task C — рядки з `MM/DD/YYYY` треба оновити на `дд.мм.рррр`, пояснити в розділі 5 нижче |

Більше консьюмерів `formatDate`/`format.js` немає: єдині три файли, що
`require('../format')`, — це рядки 1–3 вище (перевірено
`grep -rn "require(.*\/format['\"])" lib bin test server.js`, Task A).
`lib/legacy/templates.js` має власний, незалежний форматер `dmy()` — не
викликає `lib/format.js` і, оскільки каталог `templates/` на диску відсутній
(видалений 2020), практично мертвий код; змінювати не треба й впливу нема.
`lib/discounts/*` ніхто не викликає (підтверджено в Task A) — поза зоною
впливу.

## 3. Як ви їх шукали

1. **Текстовий пошук `grep -rn "formatDate" lib bin test`** — знайшов
   лише прямі виклики: `lib/invoices/render.js`, `lib/notifications/reminders.js`
   і сам `lib/format.js`/`test/format.test.js`. **Не знайшов**
   `lib/export/accounting.js` — там немає рядка `formatDate(`.
2. **Пошук усіх, хто взагалі `require`-ить `lib/format.js`**
   (`grep -rn "require(.*\/format['\"])" lib bin test server.js`) — ось тут
   і виринув `lib/export/accounting.js`, якого попередній пошук за іменем
   функції не показав.
3. **Прочитав сам файл** (`lib/export/accounting.js:29-34`, `cell()`) —
   побачив динамічний виклик `format['format' + col.type]` і звідки береться
   `col.type` — з `config/export-columns.json`. Саме це той "щонайменше один
   споживач", якого пошук за назвою функції не покаже (підказка з
   `docs/walkthrough.md`).
4. **Перевірив, хто читає вихід кожного знайденого файлу** — через
   `server.js` (список `MODULES`) і коментарі в самих `bin/*.js`
   (`lib/invoices/routes.js` → `GET /invoices/:number`; `bin/send-reminders.js`
   → `out/mail`; `bin/nightly-export.js` → `out/export`), а для
   accounting.js — через `app/docs/integrations/oblik-plus.md`, де написано,
   хто забирає файл і в якому форматі він має бути.
5. **Перевірив відсутність інших споживачів**: `grep` на `require('.*format')`
   не дав більше збігів поза трьома файлами вище; окремо перевірив
   `lib/legacy/templates.js` (має власний `dmy()`, не торкається
   `lib/format.js`) і `lib/discounts/*` (нічим не викликається — Task A, п.4).

## 4. Характеризаційні тести

| Тест | Що фіксує | Зелений на незміненому коді? |
|---|---|---|
| `app/test/invoices.characterization.test.js` | Повний HTML рахунку (не лише дату) для двох рахунків — з ЄДРПОУ і без, з "рівними" й "кривими" копійками — проти golden-файлів `test/fixtures/characterization/invoice-render.{a,b}.golden.html` | так |
| `app/test/reminders.characterization.test.js` | Який саме набір рахунків сьогодні отримує лист (upcoming / overdue / viключені: paid, draft, без email) і повний текст листа, проти `test/fixtures/characterization/reminders.golden.json` | так |
| `app/test/export/accounting.characterization.test.js` | Повний CSV для бухгалтерії: виключення drafts, формат дати `MM/DD/YYYY`, суми без "грн", `;`-розділювач, **CRLF** — проти `test/fixtures/characterization/accounting-export.golden.csv`. Цього файлу раніше не було жодного тесту | так |

Запуск: `cd app && npm test` → `tests 110`, `pass 110`, `fail 0`
(106 засіяних + 4 нові).

Коміт із тестами (до зміни): `<заповнюється після коміту>`

## 5. Після зміни (Task C)

<Заповнюється в Task C, після реалізації BILL-482.>
