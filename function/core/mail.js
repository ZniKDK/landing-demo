'use strict';
// Отправка письма через SMTP (по умолчанию — Яндекс Почта, порт 465, SSL)

/**
 * createTransport подменяется в тестах. В облаке берём его из nodemailer;
 * require внутри функции, чтобы тесты не требовали установленного nodemailer.
 */
function createMailSender({ host, port, user, pass, to, timeoutMs = 8000, createTransport }) {
  return async function sendMail({ subject, text }) {
    if (!host || !user || !pass || !to) {
      throw new Error('Почта не настроена: нет SMTP_HOST, SMTP_USER, SMTP_PASS или MAIL_TO');
    }
    const make = createTransport || require('nodemailer').createTransport;
    const portNumber = Number(port) || 465;
    const transport = make({
      host,
      port: portNumber,
      secure: portNumber === 465, // 465 — сразу SSL, 587 — STARTTLS
      auth: { user, pass },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
      dnsTimeout: timeoutMs, // по умолчанию у nodemailer 30 с — дольше, чем живёт функция
    });
    // Эти тайм-ауты считают простой между шагами, а не общее время отправки.
    // Поэтому ограничиваем всю отправку целиком: Telegram 5 с + почта 8 с < 20 с функции
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`SMTP не ответил за ${timeoutMs} мс`)), timeoutMs);
    });
    try {
      // Яндекс разрешает отправку только от имени того же ящика, что и логин
      await Promise.race([transport.sendMail({ from: user, to, subject, text }), deadline]);
    } finally {
      clearTimeout(timer); // иначе таймер держал бы процесс ещё 8 секунд
    }
  };
}

module.exports = { createMailSender };
