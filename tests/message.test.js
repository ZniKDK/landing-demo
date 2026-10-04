import { test } from 'node:test';
import assert from 'node:assert/strict';
import message from '../function/core/message.js';

const { escapeHtml, formatTelegram, formatEmail } = message;

const lead = {
  name: 'Иван', phone: '+79991234567', car: 'Kia Rio', service: 'Шиномонтаж',
  when: 'завтра', comment: 'Колёса R16',
};

test('escapeHtml экранирует &, <, >, "', () => {
  assert.equal(escapeHtml('<script>"a" & b</script>'), '&lt;script&gt;&quot;a&quot; &amp; b&lt;/script&gt;');
});

test('formatTelegram содержит все поля и название сайта', () => {
  const text = formatTelegram(lead, 'ШинТочка');
  assert.ok(text.startsWith('<b>Новая заявка — ШинТочка</b>'));
  for (const v of Object.values(lead)) assert.ok(text.includes(v), v);
});

test('formatTelegram пропускает пустые необязательные поля', () => {
  const text = formatTelegram({ ...lead, car: '', when: '', comment: '' }, 'ШинТочка');
  assert.ok(!text.includes('Авто:'));
  assert.ok(!text.includes('Время:'));
  assert.ok(!text.includes('Комментарий:'));
});

// На что смотреть №5: HTML и эмодзи не ломают разметку Telegram
test('formatTelegram экранирует ввод пользователя и сохраняет эмодзи', () => {
  const text = formatTelegram({ ...lead, name: '<b>Хакер</b> 🚗', comment: 'a & b' }, 'ШинТочка');
  assert.ok(text.includes('&lt;b&gt;Хакер&lt;/b&gt; 🚗'));
  assert.ok(text.includes('a &amp; b'));
});

test('formatEmail: тема с именем, текст без HTML-экранирования', () => {
  const mail = formatEmail({ ...lead, comment: 'a & b' }, 'ШинТочка');
  assert.equal(mail.subject, 'Заявка с сайта ШинТочка: Иван');
  assert.ok(mail.text.includes('Телефон: +79991234567'));
  assert.ok(mail.text.includes('a & b'));
});
