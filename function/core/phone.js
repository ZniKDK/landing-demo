/**
 * Российские номера телефонов: проверка и маска ввода.
 *
 * Один и тот же файл работает в двух местах:
 *  - в облачной функции: require('./phone');
 *  - в браузере: <script src="assets/js/phone.js">, функции доступны как window.LandingPhone.
 * Поэтому здесь «обёртка UMD», а не import/export: так файл понимают и Node (CommonJS), и браузер.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LandingPhone = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Первая цифра кода после +7: 3, 4, 8 — городские номера, 9 — мобильные
  var ALLOWED_FIRST_DIGITS = ['3', '4', '8', '9'];

  // Оставляет в строке только цифры
  function digitsOnly(raw) {
    return String(raw == null ? '' : raw).replace(/\D/g, '');
  }

  /**
   * Приводит номер к виду +7XXXXXXXXXX.
   * Принимает 8XXXXXXXXXX, 7XXXXXXXXXX, +7XXXXXXXXXX и 10 цифр без кода страны.
   * Возвращает null, если номер не похож на российский.
   */
  function normalizePhone(raw) {
    if (/^\s*\+(?!7)/.test(String(raw == null ? '' : raw))) {
      return null; // явно указан другой код страны, например +1
    }
    var digits = digitsOnly(raw);
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
      digits = digits.slice(1); // убираем 8 или 7 в начале
    }
    if (digits.length !== 10) {
      return null;
    }
    if (ALLOWED_FIRST_DIGITS.indexOf(digits[0]) === -1) {
      return null;
    }
    return '+7' + digits;
  }

  /**
   * Маска для поля ввода: +7 (999) 123-45-67.
   * Скобку и дефисы добавляем только после следующей цифры,
   * иначе Backspace «упирается» в автоматически добавленный символ.
   */
  function formatPhoneMask(raw) {
    var digits = digitsOnly(raw);
    // Ведущие 7 или 8 — это код страны, а не часть номера, кроме одного случая:
    // вставили ровно 10 цифр без «+7» — тогда 8 это начало кода города (812, 846)
    var pastedWithoutCountryCode = digits.length === 10 && !/^\s*\+/.test(String(raw));
    if ((digits[0] === '7' || digits[0] === '8') && !pastedWithoutCountryCode) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    if (digits.length === 0) {
      return '';
    }
    var out = '+7 (' + digits.slice(0, 3);
    if (digits.length > 3) out += ') ' + digits.slice(3, 6);
    if (digits.length > 6) out += '-' + digits.slice(6, 8);
    if (digits.length > 8) out += '-' + digits.slice(8, 10);
    return out;
  }

  return { normalizePhone: normalizePhone, formatPhoneMask: formatPhoneMask };
});
