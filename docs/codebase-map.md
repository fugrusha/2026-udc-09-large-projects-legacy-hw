# Карта кодової бази — `app/`

> Task A. Карта + перевірка щонайменше 10 тверджень.

## 1. Як агент будував карту

- **Інструмент / модель:** Claude Code (Sonnet 5, `claude-sonnet-5`). У `app/`
  уже є індекс CodeGraph (`app/.codegraph/`), тож навігація йшла переважно
  через `codegraph_explore` (повертає вербатимний код потрібних символів +
  граф викликів в одному виклику) замість послідовного читання файлів.
- **Промпт (стисло):** "проаналізуй `docs/walkthrough.md` і зроби Task A" —
  тобто прочитати методичку, потім скласти й перевірити карту `app/`.
- **Вартість навігації:**
  - Прочитано повністю: `AGENTS.md`, шаблон карти, 5 файлів конфігурації й
    документації (`ARCHITECTURE.md`, `integrations/oblik-plus.md`,
    `config/default.json`, `config/export-columns.json`, `package.json`),
    `lib/export/accounting.js`, `bin/nightly-export.js`, `lib/legacy/templates.js`.
  - Через `codegraph_explore` (5 викликів) отримано вербатимний код ще ~20
    файлів (`server.js`, `lib/http/router.js`, `lib/format.js`,
    `lib/reports/dates.js`, `lib/store.js`, усі `*/routes.js`, `bin/*.js` та
    кілька модулів `index.js`) — рівно ті символи, які питалися, без
    відкриття файлів по одному.
  - Ще 18 файлів переглянуто лише "по верхівці" (перші ~12 рядків,
    doc-комент модуля) одним пакетним `sed`-викликом, щоб заповнити таблицю
    модулів без повного читання.
  - `find` (один виклик) дав повний список файлів `app/` (~90) лише за
    іменами — для орієнтації, без вмісту.
  - 4 цілеспрямованих `grep` — не "хто що робить", а перевірка конкретних
    гіпотез (хто реально викликає `formatDate`, хто вимагає `lib/discounts`,
    чи існує `templates/`, чи є npm-залежності).
  - 1 запуск `npm test` — для підтвердження числа тестів і їх стану.
  - Разом: ≈25 tool-викликів, зміст реально проглянуто для ~48 з ~90 файлів
    (решта — лише імена з `find`). Точного токен-лічильника з цього
    інтерфейсу агенту не видно (лічильник є в UI Claude Code навколо
    розмови, але сам агент його не читає) — оцінка вартості тут за
    кількістю викликів і файлів, а не за токенами.
- **Читав усе підряд чи шукав?** Шукав. Жодного разу не відкривав файли
  поспіль "про всяк випадок": кожен виклик був або відповіддю на конкретне
  питання карти (точки входу? форматування дат? хто читає вихід?), або
  перевіркою конкретного твердження зі старої документації.

## 2. Карта

### Точки входу

| Точка входу | Що запускає | Файл |
|---|---|---|
| HTTP-сервер (`npm start`) | Піднімає `http.createServer`, реєструє маршрути 7 модулів + `/health` | `server.js:20-34` |
| HTTP API | `/api/invoices`, `/api/customers`, `/api/products`, `/api/orders`, `/api/payments`, `/api/reports`, `/api/audit` | `lib/<module>/routes.js` (7 файлів), підключені через `server.js:10-18` |
| cron 02:30 (старий сервер) | Нічний CSV-експорт для бухгалтерії «Облік-Плюс» | `bin/nightly-export.js` |
| cron 09:00, робочі дні | Нагадування про оплату → файли в `out/mail` (забирає старий SMTP-релей) | `bin/send-reminders.js` |
| cron 07:00, 1-го числа | Місячний управлінський звіт → stdout → лист | `bin/monthly-report.js` |
| CLI (раніше cron, зараз вручну) | Імпорт банківської виписки KB-2 | `bin/import-statement.js` |
| CLI | Рендер одного рахунку в HTML на stdout | `bin/render-invoice.js` |
| CLI, one-off, **НЕ запускати** | Разова правка дублікатів клієнтів (вже застосована на проді 2022-08-09) | `bin/fix-2022-duplicate-customers.js` |

### Модулі

| Модуль | Відповідальність | Живий / мертвий |
|---|---|---|
| `lib/http/router.js` | Мінімальний роутер над `http` (Express прибрали 2020) | Живий |
| `lib/store.js` | "JSON-база": lazy-load + кеш у пам'яті над `data/*.json`, запис цілим файлом | Живий, центральний |
| `lib/format.js` | Спільні форматери дати/грошей/тексту | Живий, **в центрі BILL-482** |
| `lib/invoices/*` | Виставлення рахунків з замовлення, ПДВ, HTML-рендер | Живий |
| `lib/customers/*` | CRUD, пошук, валідація, злиття дублікатів | Живий |
| `lib/orders/*` | Створення замовлень, валідація позицій, машина статусів | Живий |
| `lib/catalog/*` | Товари, прайс-листи, імпорт цін, залишки/low-stock | Живий |
| `lib/payments/*` | Парсинг банківської виписки KB-2, matching до рахунків | Живий |
| `lib/reports/*` | Звіти (виручка, aging, топ-клієнти, ПДВ), текст+JSON | Живий |
| `lib/audit/*` | Append-only журнал змін + retention/архівація | Живий |
| `lib/export/accounting.js` | Нічний CSV для «Облік-Плюс»; колонки з `config/export-columns.json`, рендер через `format['format' + type]` (динамічно!) | Живий, **зовнішній споживач** |
| `lib/discounts/*` | Накопичувальна знижка за 12 міс. обороту | **Мертвий** — від'єднаний у 2023, нічого крім власних тестів його не викликає (перевірено) |
| `lib/legacy/pdf-client.js` | Клієнт для PDF-рендер мікросервіса | Практично мертвий — ніхто його не require'ить поза власним тестом/коментарями; сервіс не існує |
| `lib/legacy/templates.js` | Власний міні-Handlebars (бо реальний тягнув пів npm) | Мертвий у проді — каталог `templates/` на диску відсутній; живе лише в тестах |

### Дані

Усе в `app/data/*.json` (customers, orders, invoices, payments, products,
price_history, stock) + один приклад виписки в `data/statements/`.
`lib/store.js` читає файл лише раз (lazy, кешує в пам'яті), пише назад
**цілим файлом** через `save()` — немає ні БД, ні транзакцій.

- **Дати:** зберігаються як рядки `YYYY-MM-DD` (ISO), жодних `Date`-об'єктів
  у файлах. `lib/format.js:formatDate()` **попри власний docstring "returns
  ... ISO format" фактично повертає `MM/DD/YYYY`** (`lib/format.js:29-34`) —
  це був предмет BILL-482. **Після реалізації тікета** (Task C):
  `formatDate()` лишили як є (`MM/DD/YYYY`) — його й далі використовує
  `lib/export/accounting.js` для нічного фіда «Облік-Плюс»; для людей
  (HTML-рахунок, лист-нагадування) додано нову `lib/format.js:formatDateUA()`
  (`дд.мм.рррр`), на яку перевели `lib/invoices/render.js` і
  `lib/notifications/reminders.js`.
- **Гроші:** цілі копійки (ніколи float) всюди в даних і розрахунках;
  `formatMoney()` — для людей ("1 234,50 грн"), `formatDecimal()` — для
  машин ("1234.50").
- Є окремий, незалежний форматер дати `dmy()` в `lib/legacy/templates.js`,
  який уже виводить `дд.мм.рррр` — але це мертвий код (дивись вище).

### Зовнішні інтеграції

- **«Облік-Плюс» (бухгалтерія).** `bin/nightly-export.js` (cron 02:30) →
  `lib/export/accounting.js` → колонки з `config/export-columns.json`
  визначають, яку функцію з `lib/format.js` викликати для кожного поля
  (`type: "Date"` → `formatDate`, динамічно: `format['format' + col.type]`).
  Файл забирає їхній сервер о 06:00. Контракт задокументований у
  `app/docs/integrations/oblik-plus.md`: вони **очікують `MM/DD/YYYY`**,
  бо їхній сервер з американською локаллю, і **мовчки пропускають** рядок з
  іншим форматом дати (інцидент лютого 2021 — "втратили" 40 рахунків).
  Це живий споживач поточного (англійського) формату `formatDate` — і він
  **не знаходиться текстовим пошуком `formatDate(`**, бо виклик динамічний.
- **Старий SMTP-релей.** `bin/send-reminders.js` лише пише `.txt`-файли в
  `out/mail`; релей забирає їх сам. Текст нагадувань використовує
  `formatDateUA()` (після Task C; до BILL-482 було `formatDate()`) для
  дати оплати — читає людина (клієнт), не система.
- **Банк (вхідний зв'язок).** `bin/import-statement.js` / `POST
  /api/payments/import` парсять фіксований формат KB-2
  (`lib/payments/statement.js`) — дати тут `DDMMYYYY`, парсяться окремим
  кодом, **не** через `lib/format.js`.
- Жодного реального MongoDB, Express чи Handlebars, PDF-сервісу — попри
  протилежні твердження в `app/docs/ARCHITECTURE.md` (див. перевірку №1).

## 3. Перевірка — 10 тверджень

| # | Твердження з карти | ✅ / ❌ | Доказ (файл:рядок або команда) |
|---|---|---|---|
| 1 | `app/docs/ARCHITECTURE.md` каже, що застосунок на Express + Handlebars, дані в MongoDB, запуск на `:3000`, потрібен `npm install` | ❌ застаріло | `server.js:5-6,32` (чистий `http` + власний `Router`); `lib/store.js` (JSON-файли, не Mongo); `config/default.json:7` (`"port": 8080`); `package.json` (без `"dependencies"`, `"start": "node server.js"`, без `npm install`) |
| 2 | «Облік-Плюс» приймає дати у `MM/DD/YYYY`, бо їхній сервер з американською локаллю (`app/docs/integrations/oblik-plus.md:23`) | ✅ | `config/export-columns.json:3-4` (`type: "Date"` для `issued_at`/`due_at`) → `lib/export/accounting.js:29-34` (`cell()` викликає `format['formatDate']` динамічно) → `lib/format.js:29-34` (`formatDate` повертає `MM/DD/YYYY`) |
| 3 | `formatDate()` у власному JSDoc стверджує `@returns {string} the date in ISO format` | ❌ коментар хибний | `lib/format.js:26-34` — функція повертає `pad(month)+'/'+pad(day)+'/'+year`, це не ISO |
| 4 | Коментар у `lib/discounts/index.js:7-9`: "Nothing calls this module at the moment" | ✅ | `grep -rl "require(.*discounts" --include="*.js" .` поза `lib/discounts/*` і `test/discounts/*` — 0 результатів у виробничому коді |
| 5 | Коментар у `lib/legacy/templates.js:14`: "templates/ was removed together with the PDF service (2020)" | ✅ | `ls app/templates` → `No such file or directory` |
| 6 | У репо «засіяно» 106 тестів, усі зелені на незміненому коді | ✅ | `cd app && npm test` → `tests 106`, `pass 106`, `fail 0` |
| 7 | У `app/` немає жодної npm-залежності (Node 22+, без build) | ✅ | `package.json` без ключа `"dependencies"`; `node_modules/` відсутній |
| 8 | HTTP-сервер реєструє рівно 7 модулів маршрутів + `/health` | ✅ | `server.js:10-18` (масив `MODULES`: invoices, customers, catalog, orders, payments, reports, audit) + `server.js:29` (`/health`) |
| 9 | `formatDate()` має трьох живих споживачів поза власними тестами, і один з них не ловиться текстовим пошуком `formatDate(` | ✅ | `lib/invoices/render.js:38-39`, `lib/notifications/reminders.js:39-46` — прямі виклики; `lib/export/accounting.js:30` — виклик через `format['format' + col.type]` (динамічний, текстовий пошук "formatDate(" це пропускає) |
| 10 | Гроші в даних і розрахунках — завжди цілі копійки, ніколи float | ✅ | `lib/store.js:9` (коментар), `lib/format.js:38` ("never floats!"), `lib/invoices/index.js:19-26` (`totals()` — ціла арифметика) |

## 4. Висновок

Агент (Sonnet 5) **не помилився в жодному перевіреному твердженні про
код** — там, де він щось стверджував на основі коду, усе підтвердилось.
Найризикованішими навмисно обрані твердження, що або (а) походять зі
**старої внутрішньої документації `app/docs/`**, яка прямо суперечить
коду (пункт 1 — архітектура з 2019 року повністю застаріла: Express/
Mongo/PDF-сервіс/порт 3000 жодного з них насправді немає), або (б) є
коментарями-твердженнями *в самому коді*, які могли встигнути відстати
від реалізації (пункти 3, 4, 5 — "ISO format", "nothing calls this",
"removed in 2020"), або (в) описують **неочевидного зовнішнього
споживача**, який не знаходиться прямим текстовим пошуком назви функції
(пункт 9 — `lib/export/accounting.js` викликає `formatDate` динамічно
через `format['format' + col.type]`, а не літералом `formatDate(...)`).
Саме пункт 9 — та "хотспот", на яку натякає підказка в Task B: простий
`grep formatDate` або пошук визначення функції не покаже
`lib/export/accounting.js` як споживача, хоча саме цей файл формує вихід
для зовнішньої системи («Облік-Плюс»), яка мовчки ламається на зміні
формату дати (див. `app/docs/integrations/oblik-plus.md` та інцидент
лютого 2021).
