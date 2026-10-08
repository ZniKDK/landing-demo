/*
 * Общие помощники анимаций для всех лендингов.
 * Без зависимостей: IntersectionObserver, requestAnimationFrame, Web Animations API.
 * Все эффекты учитывают настройку «уменьшить движение» (prefers-reduced-motion).
 */
window.Motion = (function () {
  'use strict';

  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function reduced() {
    return reducedQuery.matches;
  }

  // Вызвать cb один раз, когда элемент появится на экране
  function onVisible(el, cb, threshold) {
    if (!('IntersectionObserver' in window)) {
      cb(el);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.unobserve(entry.target);
          cb(entry.target);
        }
      });
    }, { threshold: threshold == null ? 0.2 : threshold });
    io.observe(el);
  }

  // Добавить класс is-in элементам, когда они появляются (сама анимация — в CSS сайта)
  function reveal(selector, threshold) {
    document.querySelectorAll(selector).forEach(function (el) {
      onVisible(el, function () { el.classList.add('is-in'); }, threshold);
    });
  }

  // Формат числа по-русски: 1 400, 99,9
  function format(value, decimals) {
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  // Плавно изменить число в элементе от текущего значения к target
  function tweenNumber(el, target, opts) {
    opts = opts || {};
    var decimals = opts.decimals || 0;
    var duration = reduced() ? 0 : (opts.duration || 900);
    var from = parseFloat(el.dataset.value || '0');
    var start = performance.now();
    el.dataset.value = target;
    if (el._raf) cancelAnimationFrame(el._raf);
    function step(now) {
      var p = duration ? Math.min((now - start) / duration, 1) : 1;
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(from + (target - from) * eased, decimals);
      if (p < 1) el._raf = requestAnimationFrame(step);
    }
    el._raf = requestAnimationFrame(step);
  }

  // Счётчики: <span data-count="99.9" data-decimals="1">0</span>
  function counters(selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      onVisible(el, function () {
        tweenNumber(el, parseFloat(el.dataset.count), {
          decimals: parseInt(el.dataset.decimals || '0', 10),
          duration: 1400
        });
      }, 0.6);
    });
  }

  // Разбить текст на слова/буквы в span с переменной --i (для поочерёдной анимации).
  // Слова не рвутся: буквы лежат внутри обёртки слова. Читалкам отдаём исходный текст.
  function splitText(el, mode) {
    var text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var i = 0;
    text.split(' ').forEach(function (word, wi, arr) {
      var w = document.createElement('span');
      w.className = 'split-word';
      w.setAttribute('aria-hidden', 'true');
      if (mode === 'chars') {
        Array.from(word).forEach(function (ch) {
          var c = document.createElement('span');
          c.className = 'split-char';
          c.style.setProperty('--i', i++);
          c.textContent = ch;
          w.appendChild(c);
        });
      } else {
        w.style.setProperty('--i', i++);
        w.textContent = word;
      }
      el.appendChild(w);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return i;
  }

  // Доля прокрутки элемента через экран: 0 — только показался снизу, 1 — ушёл вверх
  function progressOf(el) {
    var r = el.getBoundingClientRect();
    var total = r.height + innerHeight;
    return Math.min(Math.max((innerHeight - r.top) / total, 0), 1);
  }

  // Подписка на прокрутку с одним вызовом за кадр
  function onScroll(cb) {
    var ticking = false;
    function run() {
      ticking = false;
      cb(scrollY);
    }
    addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(run);
      }
    }, { passive: true });
    addEventListener('resize', run);
    run();
  }

  // Полоса прогресса чтения страницы (ширина через transform: scaleX)
  function scrollProgress(el) {
    onScroll(function (y) {
      var max = document.documentElement.scrollHeight - innerHeight;
      el.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    });
  }

  // Подсветка-«прожектор» под курсором: задаёт --mx/--my в карточке
  function spotlight(selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  // Плавное раскрытие <details>: анимируем высоту содержимого
  function accordion(selector) {
    document.querySelectorAll(selector).forEach(function (details) {
      var summary = details.querySelector('summary');
      var body = details.querySelector('.acc-body');
      summary.addEventListener('click', function (e) {
        if (reduced()) return;
        e.preventDefault();
        if (details.open) {
          var h = body.offsetHeight;
          details.classList.add('is-closing');
          body.animate({ height: [h + 'px', '0px'], opacity: [1, 0] }, { duration: 260, easing: 'ease-in' })
            .onfinish = function () {
              details.open = false;
              details.classList.remove('is-closing');
            };
        } else {
          details.open = true;
          var target = body.offsetHeight;
          body.animate({ height: ['0px', target + 'px'], opacity: [0, 1] }, { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      });
    });
  }

  // Детерминированный генератор случайных чисел (одинаковая «случайность» при каждой загрузке)
  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  return {
    reduced: reduced,
    onVisible: onVisible,
    reveal: reveal,
    format: format,
    tweenNumber: tweenNumber,
    counters: counters,
    splitText: splitText,
    progressOf: progressOf,
    onScroll: onScroll,
    scrollProgress: scrollProgress,
    spotlight: spotlight,
    accordion: accordion,
    seeded: seeded
  };
})();
