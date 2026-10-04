import { test } from 'node:test';
import assert from 'node:assert/strict';
import fn from '../function/index.js';

const { createHandler, MAX_BODY_BYTES } = fn;

const env = { ALLOWED_ORIGIN: 'https://znikdk.github.io', SITE_URL: 'https://znikdk.github.io/landing-demo' };
const ORIGIN = { Origin: 'https://znikdk.github.io' };
const AJAX = { ...ORIGIN, Accept: 'application/json' };

function formBody(patch = {}) {
  return new URLSearchParams({
    name: 'Иван', phone: '+7 (999) 123-45-67', service: 'tire-change', consent: 'yes',
    website: '', elapsed: '10000', ...patch,
  }).toString();
}

// Обработчик с поддельной доставкой: запоминает заявки, результат задаётся тестом
function setup(result = { ok: true, channel: 'telegram' }) {
  const delivered = [];
  const handle = createHandler({ env, deliver: async (lead) => { delivered.push(lead); return result; } });
  return { handle, delivered };
}

const post = (headers, body, extra = {}) => ({ httpMethod: 'POST', headers, body, isBase64Encoded: false, ...extra });

test('OPTIONS → 204 с CORS', async () => {
  const { handle } = setup();
  const r = await handle({ httpMethod: 'OPTIONS', headers: ORIGIN });
  assert.equal(r.statusCode, 204);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://znikdk.github.io');
  assert.match(r.headers['Access-Control-Allow-Methods'], /POST/);
});

test('чужой Origin → 403, доставки нет', async () => {
  const { handle, delivered } = setup();
  const r = await handle(post({ Origin: 'https://evil.example', Accept: 'application/json' }, formBody()));
  assert.equal(r.statusCode, 403);
  assert.equal(delivered.length, 0);
});

test('GET → 405', async () => {
  const { handle } = setup();
  assert.equal((await handle({ httpMethod: 'GET', headers: ORIGIN })).statusCode, 405);
});

test('тело больше 10 КБ → 413, доставки нет', async () => {
  const { handle, delivered } = setup();
  const r = await handle(post(AJAX, formBody({ comment: 'x'.repeat(MAX_BODY_BYTES) })));
  assert.equal(r.statusCode, 413);
  assert.equal(delivered.length, 0);
});

test('корректная заявка через fetch → 200 {ok:true}, заявка доставлена', async () => {
  const { handle, delivered } = setup();
  const r = await handle(post(AJAX, formBody()));
  assert.equal(r.statusCode, 200);
  assert.deepEqual(JSON.parse(r.body), { ok: true });
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://znikdk.github.io');
  assert.equal(delivered[0].phone, '+79991234567');
});

// На что смотреть №2: нет заголовка Origin
test('запрос без Origin обрабатывается', async () => {
  const { handle, delivered } = setup();
  const r = await handle(post({ Accept: 'application/json' }, formBody()));
  assert.equal(r.statusCode, 200);
  assert.equal(delivered.length, 1);
});

test('заголовки в нижнем регистре (локальный сервер) тоже работают', async () => {
  const { handle } = setup();
  const r = await handle(post({ origin: 'https://evil.example', accept: 'application/json' }, formBody()));
  assert.equal(r.statusCode, 403);
});

test('ошибка в поле через fetch → 422 с errors', async () => {
  const { handle } = setup();
  const r = await handle(post(AJAX, formBody({ phone: '123' })));
  assert.equal(r.statusCode, 422);
  assert.ok(JSON.parse(r.body).errors.phone);
});

test('без JS: ок → 303 на thanks/, ошибка → 303 на #form-error', async () => {
  const { handle } = setup();
  const ok = await handle(post(ORIGIN, formBody()));
  assert.equal(ok.statusCode, 303);
  assert.equal(ok.headers.Location, 'https://znikdk.github.io/landing-demo/thanks/');
  const bad = await handle(post(ORIGIN, formBody({ phone: '1' })));
  assert.equal(bad.headers.Location, 'https://znikdk.github.io/landing-demo/#form-error');
});

test('спам → «успех», но доставки нет', async () => {
  const { handle, delivered } = setup();
  const r = await handle(post(AJAX, formBody({ website: 'spam' })));
  assert.equal(r.statusCode, 200);
  assert.equal(delivered.length, 0);
});

test('доставка не удалась → 502 fallback:call, без JS → #form-fail', async () => {
  const { handle } = setup({ ok: false });
  const r = await handle(post(AJAX, formBody()));
  assert.equal(r.statusCode, 502);
  assert.deepEqual(JSON.parse(r.body), { ok: false, fallback: 'call' });
  const noJs = await handle(post(ORIGIN, formBody()));
  assert.equal(noJs.headers.Location, 'https://znikdk.github.io/landing-demo/#form-fail');
});

// На что смотреть №4: тело в base64 с кириллицей
test('тело в base64 декодируется', async () => {
  const { handle, delivered } = setup();
  const body = Buffer.from(formBody({ name: 'Пётр' }), 'utf8').toString('base64');
  const r = await handle(post(AJAX, body, { isBase64Encoded: true }));
  assert.equal(r.statusCode, 200);
  assert.equal(delivered[0].name, 'Пётр');
});
