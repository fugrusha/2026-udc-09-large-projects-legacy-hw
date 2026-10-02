/**
 * Characterization tests (Task B, BILL-482).
 *
 * Pins the CURRENT output of buildReminders(): which invoices get a mail
 * (the filtering by status/overdue/email must NOT change) and the exact
 * mail text, which embeds the due date via lib/format.js:formatDate().
 * These mails are written to out/mail by bin/send-reminders.js and read by
 * a HUMAN (the customer, via email), so BILL-482 is expected to change the
 * date inside `text` — see docs/impact.md section 5 when that happens.
 */
var fs = require('fs');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');
var reminders = require('../lib/notifications/reminders');

var customerA = { id: 1, name: 'ТОВ «Зелений Кут»', edrpou: '10000001', contact_name: 'Ірина', email: 'client1@example.invalid' };
var customerB = { id: 2, name: 'ПП Іванов', email: 'client2@example.invalid' };
var customerC = { id: 3, name: 'Без Email', contact_name: 'Петро' }; // no email on file

var today = '2026-03-09';
var invUpcoming = { id: 10, number: 'INV-2026-00010', customer_id: 1, status: 'issued', due_at: '2026-03-12', total_kopecks: 99900 };
var invOverdue = { id: 11, number: 'INV-2026-00011', customer_id: 2, status: 'issued', due_at: '2026-03-01', total_kopecks: 55500 };
var invPaid = { id: 12, number: 'INV-2026-00012', customer_id: 1, status: 'paid', due_at: '2026-03-01', total_kopecks: 10000 };
var invDraft = { id: 13, number: 'INV-2026-00013', customer_id: 1, status: 'draft', due_at: '2026-03-12', total_kopecks: 20000 };
var invNoEmail = { id: 14, number: 'INV-2026-00014', customer_id: 3, status: 'issued', due_at: '2026-03-12', total_kopecks: 30000 };

var byId = { 1: customerA, 2: customerB, 3: customerC };

test('characterization: which invoices get a reminder today, and the exact mail text', function () {
  var mails = reminders.buildReminders([invUpcoming, invOverdue, invPaid, invDraft, invNoEmail], byId, today);
  var golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/characterization/reminders.golden.json'), 'utf8'));
  assert.deepEqual(mails, golden);
});
