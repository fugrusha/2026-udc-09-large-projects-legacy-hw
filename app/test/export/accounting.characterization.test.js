/**
 * Characterization tests (Task B, BILL-482).
 *
 * lib/export/accounting.js had NO test coverage before this file. It is the
 * one consumer of lib/format.js that a plain text search for "formatDate("
 * will not find: config/export-columns.json marks the date columns with
 * type "Date", and accounting.js looks up `format['format' + col.type]`
 * dynamically (see cell() in lib/export/accounting.js).
 *
 * Its output (out/export/oblik-*.csv, written nightly by bin/nightly-export.js)
 * is read by ANOTHER SYSTEM — the "Облік-Плюс" accounting import — not a
 * human. Per app/docs/integrations/oblik-plus.md, that system expects dates
 * as MM/DD/YYYY and silently SKIPS any row with a different date format
 * (no error on our side or theirs — this is how 40 invoices went missing in
 * February 2021). BILL-482 is about dates customers see; this file must
 * keep failing RED if BILL-482 accidentally changes this output. If it ever
 * does need to change on purpose, that change must be coordinated with
 * accounting first (see the contact in oblik-plus.md), never silently.
 */
var fs = require('fs');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');
var accounting = require('../../lib/export/accounting');

var customerA = { id: 1, name: 'ТОВ «Зелений Кут»', edrpou: '10000001' };
var customerB = { id: 2, name: 'ПП Іванов' }; // no edrpou -> empty cell

var invoiceA = {
  id: 1, number: 'INV-2026-00007', customer_id: 1, issued_at: '2026-03-09', due_at: '2026-03-23',
  subtotal_kopecks: 100000, vat_kopecks: 20000, total_kopecks: 120000, status: 'issued',
};
var invoiceB = {
  id: 2, number: 'INV-2026-00008', customer_id: 2, issued_at: '2026-01-05', due_at: '2026-01-19',
  subtotal_kopecks: 33333, vat_kopecks: 6667, total_kopecks: 40000, status: 'issued',
};
var invoiceDraft = {
  id: 3, number: 'INV-2026-00009', customer_id: 1, issued_at: '2026-02-01', due_at: '2026-02-15',
  subtotal_kopecks: 50000, vat_kopecks: 10000, total_kopecks: 60000, status: 'draft',
};

test('characterization: drafts are excluded, dates stay MM/DD/YYYY, amounts stay plain decimal', function () {
  var csv = accounting.buildAccountingFile([invoiceA, invoiceB, invoiceDraft], { 1: customerA, 2: customerB });
  var golden = fs.readFileSync(path.join(__dirname, '../fixtures/characterization/accounting-export.golden.csv'), 'utf8');
  // compare content independently of the exact line-ending bytes...
  assert.equal(csv.split('\r\n').join('\n'), golden);
  // ...then assert CRLF explicitly: every line break in the real output is \r\n, never a bare \n.
  assert.equal((csv.match(/\r\n/g) || []).length, csv.split('\n').length - 1);
});
