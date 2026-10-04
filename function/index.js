'use strict';
/**
 * Точка входа Yandex Cloud Function (в консоли: «index.handler»).
 *
 * Функция получает event с полями httpMethod, headers, body, isBase64Encoded
 * и возвращает { statusCode, headers, body }.
 * Вся логика — в core/, здесь только перевод HTTP-запроса в вызовы ядра.
 */
const { parseForm, validateLead } = require('./core/validate');
const { deliver: deliverLead } = require('./core/notify');
const { createTelegramSender } = require('./core/telegram');
const { createMailSender } = require('./core/mail');
const services = require('./core/services.json');

const MAX_BODY_BYTES = 10 * 1024;

// Заголовок без учёта регистра: YCF присылает "Origin", Node.js — "origin"
function getHeader(headers, name) {
  const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

function jsonResponse(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
    body: JSON.stringify(data),
    isBase64Encoded: false,
  };
}

// 303 — браузер после POST перейдёт по адресу обычным GET
function redirect(location) {
  return { statusCode: 303, headers: { Location: location }, body: '', isBase64Encoded: false };
}

function bodySize(event) {
  const body = event.body || '';
  return event.isBase64Encoded ? Buffer.from(body, 'base64').length : Buffer.byteLength(body, 'utf8');
}

/**
 * Создаёт обработчик. Зависимости передаются снаружи, чтобы в тестах
 * подменить доставку.
 */
function createHandler({ env, deliver }) {
  // Origin всегда без слеша на конце; убираем его, если вписали по ошибке
  const allowedOrigin = (env.ALLOWED_ORIGIN || '').replace(/\/+$/, '');
  // Адрес сайта всегда со слешем в конце: к нему добавляем "thanks/" и "#form-error"
  const siteUrl = (env.SITE_URL || '/').replace(/\/?$/, '/');

  return async function handle(event) {
    const origin = getHeader(event.headers, 'origin');
    const cors = allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {};
    // form.js шлёт Accept: application/json; обычная отправка формы без JS — нет
    const wantsJson = (getHeader(event.headers, 'accept') || '').includes('application/json');
    // Отказ: скрипту — JSON с кодом ошибки, человеку без JS — страница с телефоном вместо голого JSON
    const reject = (statusCode, error) => (wantsJson
      ? jsonResponse(statusCode, { ok: false, error }, cors)
      : redirect(siteUrl + '#form-fail'));

    // Запросы с чужих сайтов не принимаем. Без Origin (curl, часть браузеров) и с "null"
    // (браузер скрыл источник из-за настроек приватности) — пропускаем, спам отсеет honeypot
    if (origin && origin !== 'null' && allowedOrigin && origin !== allowedOrigin) {
      return reject(403, 'forbidden');
    }
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
        body: '',
        isBase64Encoded: false,
      };
    }
    if (event.httpMethod !== 'POST') {
      return reject(405, 'method_not_allowed');
    }
    if (bodySize(event) > MAX_BODY_BYTES) {
      return reject(413, 'too_large');
    }

    const fields = parseForm(event.body, event.isBase64Encoded);
    const result = validateLead(fields, { services });

    if (result.status === 'spam') {
      // Боту отвечаем «успехом», чтобы он не подбирал обход
      return wantsJson ? jsonResponse(200, { ok: true }, cors) : redirect(siteUrl + 'thanks/');
    }
    if (result.status === 'invalid') {
      return wantsJson
        ? jsonResponse(422, { ok: false, errors: result.errors }, cors)
        : redirect(siteUrl + '#form-error');
    }

    const sent = await deliver(result.lead);
    if (sent.ok) {
      return wantsJson ? jsonResponse(200, { ok: true }, cors) : redirect(siteUrl + 'thanks/');
    }
    return wantsJson
      ? jsonResponse(502, { ok: false, fallback: 'call' }, cors)
      : redirect(siteUrl + '#form-fail');
  };
}

// Настоящие зависимости из переменных окружения функции
function createDefaultDeps(env) {
  // Лог в формате JSON — его удобно фильтровать в Yandex Cloud Logging
  const log = (event, detail) => console.log(JSON.stringify({ event, detail }));

  // DRY_RUN=1 — только для локальной проверки: заявка печатается в консоль и никуда не уходит
  const dryRun = env.DRY_RUN === '1';
  const sendTelegram = dryRun
    ? async (html) => console.log('[DRY_RUN] Telegram:\n' + html)
    : createTelegramSender({ token: env.TG_BOT_TOKEN, chatId: env.TG_CHAT_ID });
  const sendMail = dryRun
    ? async (mail) => console.log('[DRY_RUN] Письмо: ' + mail.subject)
    : createMailSender({
      host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS, to: env.MAIL_TO,
    });

  return {
    env,
    deliver: async (lead) => {
      const result = await deliverLead(lead, { sendTelegram, sendMail, siteName: env.SITE_NAME || 'сайт', log });
      log(result.ok ? 'lead_delivered' : 'lead_failed', result.channel || null);
      return result;
    },
  };
}

// Обработчик создаётся один раз и переиспользуется между вызовами «тёплой» функции
let cachedHandle;
async function handler(event) {
  if (!cachedHandle) {
    cachedHandle = createHandler(createDefaultDeps(process.env));
  }
  return cachedHandle(event);
}

module.exports = { handler, createHandler, createDefaultDeps, MAX_BODY_BYTES };
