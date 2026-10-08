/*
 * Переключатель темы: «как в системе» → светлая → тёмная.
 * Режим хранится в localStorage (общий для всех лендингов витрины).
 * Ранний выбор темы (без мигания) делает инлайн-скрипт в <head> каждой страницы,
 * этот файл только вешает обработчик на кнопку и следит за системной темой.
 */
(function () {
  'use strict';

  var KEY = 'ls-theme';
  var MODES = ['system', 'light', 'dark'];
  var LABELS = { system: 'как в системе', light: 'светлая', dark: 'тёмная' };
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function readMode() {
    try {
      return localStorage.getItem(KEY) || 'system';
    } catch (e) {
      return 'system';
    }
  }

  function saveMode(mode) {
    try {
      localStorage.setItem(KEY, mode);
    } catch (e) {
      /* приватный режим — просто не запоминаем */
    }
  }

  // Применяем режим: в data-theme всегда итоговая тема (light/dark)
  function apply(mode) {
    var dark = mode === 'dark' || (mode === 'system' && media.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.themeMode = mode;
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', 'Тема: ' + LABELS[mode] + '. Нажмите, чтобы сменить');
      btn.title = 'Тема: ' + LABELS[mode];
    });
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: root.dataset.theme } }));
  }

  // Круговое «проявление» новой темы от кнопки (View Transitions API, если есть)
  function switchWithTransition(mode, btn) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) {
      apply(mode);
      return;
    }
    var r = btn.getBoundingClientRect();
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var t = document.startViewTransition(function () { apply(mode); });
    t.ready.then(function () {
      document.documentElement.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 550, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var next = MODES[(MODES.indexOf(readMode()) + 1) % MODES.length];
    saveMode(next);
    switchWithTransition(next, btn);
  });

  // Если выбран режим «как в системе» — реагируем на смену темы ОС
  media.addEventListener('change', function () {
    if (readMode() === 'system') apply('system');
  });

  apply(readMode());
})();
