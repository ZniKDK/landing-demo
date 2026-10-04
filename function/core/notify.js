'use strict';
// Доставка заявки: сначала Telegram, при сбое — письмо.
// В лог пишем только канал и текст ошибки, без имени и телефона (152-ФЗ).

const { formatTelegram, formatEmail } = require('./message');

async function deliver(lead, { sendTelegram, sendMail, siteName, log = () => {} }) {
  try {
    await sendTelegram(formatTelegram(lead, siteName));
    return { ok: true, channel: 'telegram' };
  } catch (err) {
    log('telegram_failed', err.message);
  }
  try {
    await sendMail(formatEmail(lead, siteName));
    return { ok: true, channel: 'email' };
  } catch (err) {
    log('email_failed', err.message);
  }
  return { ok: false };
}

module.exports = { deliver };
