// JSON для вставки внутрь <script> (микроразметка JSON-LD).
// Символ "<" заменяем на <: так строка "</script>" из текста клиента не закроет тег раньше времени.
// Для JSON.parse это та же самая строка.
export function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
