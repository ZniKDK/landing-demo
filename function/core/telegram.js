'use strict';
// Отправка сообщения в Telegram через Bot API (метод sendMessage)

/**
 * Создаёт функцию отправки. fetchImpl подменяется в тестах, в облаке — встроенный fetch Node.js.
 * Текст ошибки никогда не содержит токен: он мог бы попасть в логи.
 */
function createTelegramSender({ token, chatId, fetchImpl = fetch, timeoutMs = 5000 }) {
  return async function sendTelegram(html) {
    if (!token || !chatId) {
      throw new Error('Telegram не настроен: нет TG_BOT_TOKEN или TG_CHAT_ID');
    }
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      // Если Telegram не ответил за timeoutMs — прерываем запрос и переходим к почте
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Telegram ответил HTTP ${response.status}`);
    }
  };
}

module.exports = { createTelegramSender };
