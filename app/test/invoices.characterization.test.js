/**
 * Characterization tests (Task B, BILL-482).
 *
 * Pins the CURRENT full HTML output of the customer-facing invoice page,
 * including the date format render() gets from lib/format.js:formatDate().
 * This consumer is read by a HUMAN (the customer, via browser/print) through
 * GET /invoices/:number and bin/render-invoice.js, so BILL-482 is expected
 * to change these golden files (dates should become dd.mm.yyyy) — see
 * docs/impact.md section 5 for the explanation when that happens.
 */
var fs = require('fs');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');
var render = require('../lib/invoices/render');

function golden(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures/characterization', name), 'utf8');
}

var customerA = { id: 1, name: 'ТОВ «Зелений Кут»', edrpou: '10000001', contact_name: 'Ірина', email: 'client1@example.invalid' };
var customerB = { id: 2, name: 'ПП Іванов', email: 'client2@example.invalid' };

var invoiceA = {
  id: 1, number: 'INV-2026-00007', customer_id: 1, issued_at: '2026-03-09', due_at: '2026-03-23',
  vat_rate: 20, subtotal_kopecks: 100000, vat_kopecks: 20000, total_kopecks: 120000, status: 'issued',
  lines: [{ title: 'Папір А4, пачка', qty: 4, unit_price_kopecks: 25000 }],
};
var invoiceB = {
  id: 2, number: 'INV-2026-00008', customer_id: 2, issued_at: '2026-01-05', due_at: '2026-01-19',
  vat_rate: 20, subtotal_kopecks: 33333, vat_kopecks: 6667, total_kopecks: 40000, status: 'issued',
  lines: [{ title: 'Серветки', qty: 3, unit_price_kopecks: 11111 }],
};

test('characterization: invoice HTML for a customer with EDRPOU', function () {
  assert.equal(render.renderInvoiceHtml(invoiceA, customerA) + '\n', golden('invoice-render.a.golden.html'));
});

test('characterization: invoice HTML for a customer without EDRPOU, odd kopeck rounding', function () {
  assert.equal(render.renderInvoiceHtml(invoiceB, customerB) + '\n', golden('invoice-render.b.golden.html'));
});
