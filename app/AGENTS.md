# AGENTS.md — `app/` (prykladpostach-billing)

Read this before touching anything below. It's the knowledge that isn't
visible just from reading the code — contracts with other systems, dead
code that looks live, and which internal docs to distrust.

## Contracts with other systems — breaking these fails silently

- **`lib/export/accounting.js` feeds the "Облік-Плюс" accounting system**
  (nightly CSV, `bin/nightly-export.js`, cron 02:30 → `out/export/oblik-*.csv`,
  picked up at 06:00). Contract is in `app/docs/integrations/oblik-plus.md`:
  dates **must** be `MM/DD/YYYY`, `;` separator, CRLF line endings, UTF-8.
  **If a row's date is in any other format, Облік-Плюс does not error —
  it silently skips that row.** No exception on our side either. This
  already happened: February 2021, 40 invoices "disappeared" for three
  weeks before anyone noticed the VAT report didn't add up.
- **The trap:** `lib/export/accounting.js` does **not** call `formatDate(`
  as a literal string anywhere. It reads the column type from
  `config/export-columns.json` (`"type": "Date"` for `issued_at`/`due_at`)
  and dispatches dynamically: `format['format' + col.type]`
  (`lib/export/accounting.js:30`). **A text search for `formatDate(` will
  not find this consumer.** If you need to find everyone who depends on
  a `lib/format.js` function, search for `require(.*format)` across the
  whole tree, not for the function name.
- Confirmed by a control run (`docs/ai-on-legacy.md`): given only the
  BILL-482 ticket and no course hints, a fast/cheap model edited
  `formatDate()` directly, reported "comprehensive coverage," and never
  mentioned `accounting.js` — which silently flipped the accounting feed's
  dates from `03/09/2026` to `09.03.2026`.
- **If you need to change date formatting for customers again:** don't
  touch `formatDate()` in `lib/format.js` — it's now dedicated to the
  Облік-Плюс format on purpose. Add a new function (see `formatDateUA`,
  added for BILL-482) and point only the customer-facing call sites at it.
  Any change that *does* need to touch the accounting feed's format must
  be coordinated with accounting first (contact in `oblik-plus.md`) — not
  shipped as a side effect of an unrelated ticket.

## Stale documentation — don't trust `app/docs/` at face value

- **`app/docs/ARCHITECTURE.md` is from 2019 and describes a system that no
  longer exists**: Express + Handlebars templates + MongoDB, port 3000,
  needs `npm install`. None of that is true. The real stack: plain
  Node `http` + a hand-rolled router (`lib/http/router.js`), JSON files
  via `lib/store.js` (lazy-loaded, cached in memory, no DB), port 8080
  (`config/default.json`), zero npm dependencies. See `docs/codebase-map.md`
  (verification #1) for the file:line evidence. Treat every claim in
  `app/docs/` as something to check against the code, not as ground truth.
- `app/docs/integrations/oblik-plus.md`, by contrast, **is accurate and
  load-bearing** — see the contract section above.

## Dead code that still looks alive

- **`lib/discounts/*`** — loyalty discount tiers. Looks fully wired
  (routes-shaped exports, config flag in `config/features.json`), but
  nothing in `lib/invoices` or any route calls it; only its own tests do
  (confirmed: `grep -rl "require(.*discounts" --include="*.js" .` outside
  `lib/discounts`/`test/discounts` → zero hits). Unhooked in 2023 per the
  file's own comment. Don't assume invoices apply any discount — they don't.
- **`lib/legacy/pdf-client.js`** and **`lib/legacy/templates.js`** — client
  and template engine for a PDF-render microservice that was removed in
  2020. The `templates/` directory they'd read from doesn't exist on disk
  at all (`ls app/templates` → no such file or directory). Only
  `test/legacy/templates.test.js` exercises `templates.js` directly;
  nothing in the app requires `pdf-client.js`. Don't "fix" either — they're
  kept per an explicit `TODO(2021-03): delete this ... once accounting
  confirms nobody needs PDFs any more` comment, not accidentally orphaned.

## Where things are, if you need a refresher

- Full entry-point/module map with evidence: `docs/codebase-map.md`.
- Full consumer analysis for `lib/format.js`'s date formatter, plus the
  reasoning behind the characterization tests: `docs/impact.md`.
- Characterization tests for every `formatDate`/`formatDateUA` consumer:
  `app/test/invoices.characterization.test.js`,
  `app/test/reminders.characterization.test.js`,
  `app/test/export/accounting.characterization.test.js` (the last one had
  zero coverage before BILL-482 — it's the one that would catch the
  Облік-Плюс regression above).
