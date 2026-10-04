import { test } from 'node:test';
import assert from 'node:assert/strict';
import validate from '../function/core/validate.js';

const { parseForm, validateLead } = validate;

const NOW = 1_700_000_000_000;
const services = [{ id: 'tire-change', name: 'Шиномонтаж' }, { id: 'other', name: 'Другое' }];
const opts = { services, now: NOW };

// Корректная заявка; каждый тест портит одно поле
function validFields() {
  return {
    name: 'Иван', phone: '8 (999) 123-45-67', car: 'Kia Rio', service: 'tire-change',
    when: 'завтра утром', comment: '', consent: 'yes', website: '', ts: String(NOW - 10_000),
  };
}

test('корректная заявка → ok, телефон нормализован, услуга по названию', () => {
  const r = validateLead(validFields(), opts);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.lead, {
    name: 'Иван', phone: '+79991234567', car: 'Kia Rio', service: 'Шиномонтаж', when: 'завтра утром', comment: '',
  });
});

test('ошибки полей', () => {
  const cases = [
    ['name', { name: '' }], ['name', { name: 'И' }], ['name', { name: 'И'.repeat(51) }],
    ['phone', { phone: '123' }], ['service', { service: 'unknown' }], ['service', { service: '' }],
    ['consent', { consent: '' }], ['car', { car: 'x'.repeat(61) }], ['when', { when: 'x'.repeat(61) }],
    ['comment', { comment: 'x'.repeat(501) }],
  ];
  for (const [field, patch] of cases) {
    const r = validateLead({ ...validFields(), ...patch }, opts);
    assert.equal(r.status, 'invalid', JSON.stringify(patch));
    assert.ok(r.errors[field], `ожидалась ошибка в ${field}`);
  }
});

test('спам: honeypot, слишком быстро, слишком старая форма, мусор в ts', () => {
  for (const patch of [{ website: 'http://spam' }, { ts: String(NOW - 1000) },
    { ts: String(NOW - 25 * 3600 * 1000) }, { ts: 'abc' }]) {
    assert.equal(validateLead({ ...validFields(), ...patch }, opts).status, 'spam', JSON.stringify(patch));
  }
});

// На что смотреть №1: без JS поля ts нет — заявка должна дойти
test('нет поля ts (отправка без JS) → не спам', () => {
  const fields = validFields();
  delete fields.ts;
  assert.equal(validateLead(fields, opts).status, 'ok');
});

// На что смотреть №5: переводы строк в однострочных полях схлопываются
test('однострочные поля схлопывают пробелы и переводы строк, комментарий сохраняет абзацы', () => {
  const r = validateLead({ ...validFields(), name: '  Иван\r\nBcc: x@y.ru ', comment: 'строка 1\r\nстрока 2' }, opts);
  assert.equal(r.lead.name, 'Иван Bcc: x@y.ru');
  assert.equal(r.lead.comment, 'строка 1\nстрока 2');
});

test('parseForm разбирает urlencoded', () => {
  assert.deepEqual(parseForm('name=%D0%98%D0%B2%D0%B0%D0%BD&phone=%2B7999', false), { name: 'Иван', phone: '+7999' });
  assert.deepEqual(parseForm('', false), {});
  assert.deepEqual(parseForm(undefined, false), {});
});

// На что смотреть №4: base64 с кириллицей
test('parseForm декодирует base64 как UTF-8', () => {
  const body = Buffer.from('name=Иван+Петров&car=Лада', 'utf8').toString('base64');
  assert.deepEqual(parseForm(body, true), { name: 'Иван Петров', car: 'Лада' });
});
