'use strict';
// Разбор тела запроса и проверка полей заявки.
// Сервер проверяет всё заново: проверке в браузере доверять нельзя, её легко обойти.

const { normalizePhone } = require('./phone');

// Быстрее 3 секунд форму заполняет только бот
const MIN_FILL_MS = 3000;
// Форма, открытая больше суток назад, — подозрительно (повтор старого запроса)
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

// Ограничения длины: [минимум, максимум]
const LIMITS = {
  name: [2, 50],
  car: [0, 60],
  when: [0, 60],
  comment: [0, 500],
};

const MESSAGES = {
  name: 'Укажите имя (от 2 до 50 символов)',
  phone: 'Введите номер в формате +7 (999) 123-45-67',
  service: 'Выберите услугу',
  consent: 'Нужно согласие на обработку данных',
  car: 'Не длиннее 60 символов',
  when: 'Не длиннее 60 символов',
  comment: 'Не длиннее 500 символов',
};

// Однострочное поле: любые пробелы и переводы строк → один пробел.
// Это ещё и защита: перевод строки в имени мог бы подставить лишний заголовок в письмо.
function singleLine(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

// Многострочное поле (комментарий): приводим переводы строк к \n и обрезаем края
function multiLine(value) {
  return String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
}

// Тело запроса формы (application/x-www-form-urlencoded) → объект { поле: значение }
function parseForm(body, isBase64Encoded) {
  const text = isBase64Encoded
    ? Buffer.from(body || '', 'base64').toString('utf8')
    : String(body || '');
  return Object.fromEntries(new URLSearchParams(text));
}

function isSpam(fields, now) {
  // Скрытое поле видят только боты — человек его не заполнит
  if (singleLine(fields.website) !== '') return true;
  // Без JavaScript поле ts пустое — проверку времени пропускаем, honeypot остаётся
  if (!fields.ts) return false;
  const ts = Number(fields.ts);
  if (!Number.isFinite(ts)) return true;
  const age = now - ts;
  return age < MIN_FILL_MS || age > MAX_FORM_AGE_MS;
}

function checkLength(errors, field, value) {
  const [min, max] = LIMITS[field];
  if (value.length < min || value.length > max) {
    errors[field] = MESSAGES[field];
  }
}

/**
 * Проверяет заявку.
 * @returns {{status:'ok', lead:object} | {status:'spam'} | {status:'invalid', errors:object}}
 */
function validateLead(fields, { services, now }) {
  if (isSpam(fields, now)) {
    return { status: 'spam' };
  }

  const errors = {};
  const name = singleLine(fields.name);
  const car = singleLine(fields.car);
  const when = singleLine(fields.when);
  const comment = multiLine(fields.comment);

  checkLength(errors, 'name', name);
  checkLength(errors, 'car', car);
  checkLength(errors, 'when', when);
  checkLength(errors, 'comment', comment);

  const phone = normalizePhone(fields.phone);
  if (!phone) errors.phone = MESSAGES.phone;

  const service = services.find((s) => s.id === fields.service);
  if (!service) errors.service = MESSAGES.service;

  if (!fields.consent) errors.consent = MESSAGES.consent;

  if (Object.keys(errors).length > 0) {
    return { status: 'invalid', errors };
  }
  return {
    status: 'ok',
    lead: { name, phone, car, service: service.name, when, comment },
  };
}

module.exports = { parseForm, validateLead, MIN_FILL_MS, MAX_FORM_AGE_MS };
