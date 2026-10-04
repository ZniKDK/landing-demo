'use strict';
// Текст заявки для Telegram (HTML-разметка) и для письма (обычный текст)

// Telegram в режиме HTML требует экранировать эти символы, иначе сообщение не отправится
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Пары «подпись — значение»; пустые необязательные поля не выводим
function leadLines(lead) {
  return [
    ['Имя', lead.name],
    ['Телефон', lead.phone],
    ['Авто', lead.car],
    ['Услуга', lead.service],
    ['Время', lead.when],
    ['Комментарий', lead.comment],
  ].filter(([, value]) => value);
}

function formatTelegram(lead, siteName) {
  const lines = leadLines(lead).map(([label, value]) => `${label}: ${escapeHtml(value)}`);
  return [`<b>Новая заявка — ${escapeHtml(siteName)}</b>`, ...lines].join('\n');
}

function formatEmail(lead, siteName) {
  return {
    subject: `Заявка с сайта ${siteName}: ${lead.name}`,
    text: leadLines(lead).map(([label, value]) => `${label}: ${value}`).join('\n'),
  };
}

module.exports = { escapeHtml, formatTelegram, formatEmail };
