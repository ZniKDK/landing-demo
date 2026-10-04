import { test } from 'node:test';
import assert from 'node:assert/strict';
import telegram from '../function/core/telegram.js';
import mail from '../function/core/mail.js';
import notify from '../function/core/notify.js';

const { createTelegramSender } = telegram;
const { createMailSender } = mail;
const { deliver } = notify;

const lead = { name: 'Иван', phone: '+79991234567', car: '', service: 'Шиномонтаж', when: '', comment: '' };

test('Telegram: правильный URL и тело запроса', async () => {
  let call;
  const send = createTelegramSender({
    token: 'TOKEN123', chatId: '42',
    fetchImpl: async (url, init) => { call = { url, init }; return { ok: true, status: 200 }; },
  });
  await send('<b>hi</b>');
  assert.equal(call.url, 'https://api.telegram.org/botTOKEN123/sendMessage');
  assert.deepEqual(JSON.parse(call.init.body),
    { chat_id: '42', text: '<b>hi</b>', parse_mode: 'HTML', disable_web_page_preview: true });
});

test('Telegram: ошибка HTTP → исключение без токена в тексте', async () => {
  const send = createTelegramSender({
    token: 'SECRET', chatId: '42', fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  await assert.rejects(send('x'), (err) => !err.message.includes('SECRET') && err.message.includes('401'));
});

test('Telegram: не настроен → исключение', async () => {
  await assert.rejects(createTelegramSender({ token: '', chatId: '' })('x'), /не настроен/);
});

// На что смотреть №3: Telegram не отвечает — срабатывает тайм-аут
test('Telegram: тайм-аут прерывает зависший запрос', async () => {
  const send = createTelegramSender({
    token: 't', chatId: '1', timeoutMs: 50,
    fetchImpl: (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    }),
  });
  await assert.rejects(send('x'));
});

test('Почта: параметры SMTP и письмо', async () => {
  let options; let sent;
  const send = createMailSender({
    host: 'smtp.yandex.ru', port: '465', user: 'bot@yandex.ru', pass: 'p', to: 'owner@yandex.ru',
    createTransport: (o) => { options = o; return { sendMail: async (m) => { sent = m; } }; },
  });
  await send({ subject: 'Тема', text: 'Текст' });
  assert.equal(options.secure, true);
  assert.equal(options.port, 465);
  assert.equal(options.socketTimeout, 8000);
  assert.deepEqual(sent, { from: 'bot@yandex.ru', to: 'owner@yandex.ru', subject: 'Тема', text: 'Текст' });
});

test('Почта: не настроена → исключение', async () => {
  await assert.rejects(createMailSender({ host: '', user: '', pass: '', to: '' })({ subject: 's', text: 't' }), /не настроен/);
});

test('deliver: Telegram ок → почта не вызывается', async () => {
  let mailCalled = false;
  const r = await deliver(lead, {
    siteName: 'Т', sendTelegram: async () => {}, sendMail: async () => { mailCalled = true; },
  });
  assert.deepEqual(r, { ok: true, channel: 'telegram' });
  assert.equal(mailCalled, false);
});

test('deliver: Telegram упал → письмо', async () => {
  let mailed;
  const r = await deliver(lead, {
    siteName: 'Т', sendTelegram: async () => { throw new Error('down'); }, sendMail: async (m) => { mailed = m; },
  });
  assert.deepEqual(r, { ok: true, channel: 'email' });
  assert.equal(mailed.subject, 'Заявка с сайта Т: Иван');
});

test('deliver: оба упали → ok:false, в логах нет имени и телефона', async () => {
  const logs = [];
  const r = await deliver(lead, {
    siteName: 'Т',
    sendTelegram: async () => { throw new Error('tg down'); },
    sendMail: async () => { throw new Error('smtp down'); },
    log: (...args) => logs.push(JSON.stringify(args)),
  });
  assert.deepEqual(r, { ok: false });
  assert.equal(logs.length, 2);
  for (const line of logs) {
    assert.ok(!line.includes('Иван') && !line.includes('79991234567'), line);
  }
});

// На что смотреть №3: зависший Telegram → через тайм-аут письмо
test('deliver: Telegram завис → после тайм-аута уходит письмо', async () => {
  const sendTelegram = createTelegramSender({
    token: 't', chatId: '1', timeoutMs: 50,
    fetchImpl: (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    }),
  });
  const r = await deliver(lead, { siteName: 'Т', sendTelegram, sendMail: async () => {} });
  assert.deepEqual(r, { ok: true, channel: 'email' });
});

// Ревью, Important 3: тайм-ауты nodemailer считают простой между командами, а не общее время.
// Общий лимит не даёт функции выйти за 20 секунд Yandex Cloud
test('Почта: зависший SMTP прерывается по общему лимиту времени', async () => {
  const send = createMailSender({
    host: 'h', port: '465', user: 'u', pass: 'p', to: 't', timeoutMs: 50,
    createTransport: () => ({ sendMail: () => new Promise(() => {}) }),
  });
  await assert.rejects(send({ subject: 's', text: 't' }), /не ответил/);
});

test('Почта: DNS-запрос тоже ограничен тайм-аутом', async () => {
  let options;
  const send = createMailSender({
    host: 'h', port: '465', user: 'u', pass: 'p', to: 't',
    createTransport: (o) => { options = o; return { sendMail: async () => {} }; },
  });
  await send({ subject: 's', text: 't' });
  assert.equal(options.dnsTimeout, 8000);
});
