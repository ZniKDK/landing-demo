/*
 * Форма заявки: маска телефона, проверка полей, отправка без перезагрузки страницы.
 * Телефон проверяется функциями из phone.js (window.LandingPhone) — теми же, что и на сервере.
 * Если JavaScript выключен, форма отправляется обычным POST, а сервер сделает редирект.
 */
(function () {
  'use strict';

  var form = document.querySelector('[data-lead-form]');
  if (!form || !window.LandingPhone) return;

  // Проверку полей берём на себя (сообщения под полями), поэтому встроенную проверку браузера
  // выключаем здесь, а не в разметке: без JavaScript она останется и сохранит введённые данные
  form.noValidate = true;

  var phoneApi = window.LandingPhone;
  var phoneInput = form.elements.phone;
  var statusEl = form.querySelector('.form__status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var successEl = document.querySelector('.form-success');
  var failEl = document.getElementById('form-fail');
  var FIELDS = ['name', 'phone', 'car', 'service', 'when', 'comment', 'consent'];

  var MESSAGES = {
    name: 'Укажите имя (от 2 до 50 символов)',
    phone: 'Введите номер в формате +7 (999) 123-45-67',
    service: 'Выберите услугу',
    consent: 'Нужно согласие на обработку данных'
  };

  // Момент открытия формы. При отправке передаём, сколько она была открыта:
  // сервер отсеет заполнение быстрее 3 секунд (так делают боты)
  var openedAt = Date.now();

  // Маска телефона при вводе
  phoneInput.addEventListener('input', function () {
    phoneInput.value = phoneApi.formatPhoneMask(phoneInput.value);
  });

  // Показывает (или убирает) ошибку под полем; скринридер свяжет её с полем через aria-describedby
  function setError(name, text) {
    var input = form.elements[name];
    var errorEl = document.getElementById('f-' + name + '-error');
    if (!input || !errorEl) return;
    errorEl.textContent = text || '';
    if (text) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }

  function showErrors(errors) {
    FIELDS.forEach(function (name) { setError(name, errors[name]); });
    var first = FIELDS.filter(function (name) { return errors[name]; })[0];
    if (first) form.elements[first].focus();
  }

  // Та же проверка, что на сервере, — чтобы человек видел ошибку сразу
  function validate() {
    var errors = {};
    var name = form.elements.name.value.trim();
    if (name.length < 2 || name.length > 50) errors.name = MESSAGES.name;
    if (!phoneApi.normalizePhone(phoneInput.value)) errors.phone = MESSAGES.phone;
    if (!form.elements.service.value) errors.service = MESSAGES.service;
    if (!form.elements.consent.checked) errors.consent = MESSAGES.consent;
    return errors;
  }

  function showFail() {
    statusEl.textContent = '';
    if (failEl) {
      failEl.classList.add('is-visible');
      failEl.scrollIntoView({ block: 'nearest' });
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (failEl) failEl.classList.remove('is-visible');

    var errors = validate();
    showErrors(errors);
    if (Object.keys(errors).length > 0) {
      statusEl.textContent = 'Проверьте отмеченные поля.';
      return;
    }
    // В демо без подключённой функции форма никуда не отправляется
    if (!form.getAttribute('action')) {
      statusEl.textContent = 'Демо-режим: обработчик заявок не подключён.';
      return;
    }

    form.elements.elapsed.value = String(Date.now() - openedAt);

    // Блокируем кнопку, чтобы двойной клик не создал две заявки
    submitBtn.disabled = true;
    statusEl.textContent = 'Отправляем…';

    fetch(form.action, {
      method: 'POST',
      body: new URLSearchParams(new FormData(form)),
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        return response.json()
          .catch(function () { return {}; })
          .then(function (data) { return { status: response.status, data: data }; });
      })
      .then(function (result) {
        if (result.data.ok) {
          form.hidden = true;
          successEl.hidden = false;
          successEl.focus();
          return;
        }
        if (result.status === 422 && result.data.errors) {
          showErrors(result.data.errors);
          statusEl.textContent = 'Проверьте отмеченные поля.';
          return;
        }
        showFail();
      })
      .catch(showFail)
      .finally(function () { submitBtn.disabled = false; });
  });
})();
