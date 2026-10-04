import { test } from 'node:test';
import assert from 'node:assert/strict';
import phone from '../function/core/phone.js';

const { normalizePhone, formatPhoneMask } = phone;

test('normalizePhone принимает распространённые форматы', () => {
  for (const raw of ['89991234567', '+79991234567', '79991234567', '9991234567',
    '+7 (999) 123-45-67', '8 999 123 45 67', '8-999-123-45-67']) {
    assert.equal(normalizePhone(raw), '+79991234567', raw);
  }
  assert.equal(normalizePhone('8 (812) 123-45-67'), '+78121234567');
  assert.equal(normalizePhone('+7 495 123 45 67'), '+74951234567');
});

test('normalizePhone отклоняет мусор и неверную длину', () => {
  for (const raw of ['', null, undefined, 'abc', '12345', '999123456', '899912345678', '+1 (999) 123-45-67']) {
    assert.equal(normalizePhone(raw), null, String(raw));
  }
});

test('normalizePhone отклоняет недопустимую первую цифру кода', () => {
  assert.equal(normalizePhone('+7 (199) 123-45-67'), null);
  assert.equal(normalizePhone('+7 (599) 123-45-67'), null);
  assert.equal(normalizePhone('+7 (799) 123-45-67'), null);
});

test('formatPhoneMask строит маску по мере ввода', () => {
  assert.equal(formatPhoneMask(''), '');
  assert.equal(formatPhoneMask('8'), '');
  assert.equal(formatPhoneMask('9'), '+7 (9');
  assert.equal(formatPhoneMask('999'), '+7 (999');
  assert.equal(formatPhoneMask('9991'), '+7 (999) 1');
  assert.equal(formatPhoneMask('9991234'), '+7 (999) 123-4');
  assert.equal(formatPhoneMask('89991234567'), '+7 (999) 123-45-67');
  assert.equal(formatPhoneMask('+7 (999) 123-45-6789'), '+7 (999) 123-45-67');
});

test('formatPhoneMask не мешает стирать: "+7 (999)" → "+7 (999"', () => {
  assert.equal(formatPhoneMask('+7 (999)'), '+7 (999');
});
