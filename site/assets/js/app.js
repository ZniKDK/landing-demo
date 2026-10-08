/*
 * Интерактив главной страницы «ШинТочки»:
 *  - колесо крутится при прокрутке, полосы поребрика едут;
 *  - табло пит-стопа считает время до ближайшего свободного окна;
 *  - калькулятор переобувки (данные — site.calc из site.json);
 *  - расшифровка маркировки шины (site.tyre);
 *  - машинка едет по трассе в блоке «Как записаться»;
 *  - выбор окна записи подставляет день и время в форму.
 * Общие помощники анимаций — в motion.js (window.Motion).
 */
(function () {
  'use strict';

  var M = window.Motion;
  if (!M) return;

  var root = document.documentElement;
  var reduced = M.reduced();

  function readJson(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function rub(value) {
    return M.format(value, 0);
  }

  // Повернуть все вращающиеся части колеса (SVG-атрибут надёжнее CSS-transform у групп SVG)
  function rotateWheel(svg, angle) {
    svg.querySelectorAll('.wheel__spin').forEach(function (g) {
      g.setAttribute('transform', 'rotate(' + angle.toFixed(1) + ')');
    });
  }

  /* ---------- Общие эффекты ---------- */

  M.reveal('.reveal', 0.15);
  M.accordion('.faq');
  M.spotlight('.feature');
  var progress = document.querySelector('.progress');
  if (progress) M.scrollProgress(progress);

  // Колесо на первом экране вращается вместе с прокруткой, поребрик едет вбок
  var heroWheel = document.querySelector('.hero .wheel');
  M.onScroll(function (y) {
    if (reduced) return;
    if (heroWheel) rotateWheel(heroWheel, y * 0.4);
    root.style.setProperty('--kerb-x', String(Math.round(y * 0.6)));
  });

  /* ---------- Расписание: часы работы и занятые окна ---------- */

  // «Mo-Su 08:00-21:00» → { open: 480, close: 1260 } в минутах от полуночи
  function parseHours(text) {
    var m = /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/.exec(text || '');
    if (!m) return { open: 480, close: 1260 };
    return { open: +m[1] * 60 + +m[2], close: +m[3] * 60 + +m[4] };
  }

  var board = document.querySelector('[data-board]');
  var HOURS = parseHours(board ? board.dataset.hours : '');
  var STEP = 30; // длина окна записи, минут

  // Занятость окон «случайная», но одинаковая весь день: генератор с сидом из даты.
  // Табло и выбор времени в форме опираются на одну и ту же функцию — данные не расходятся
  function busySlots(date) {
    var seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    var rnd = M.seeded(seed);
    var busy = {};
    for (var t = HOURS.open; t < HOURS.close; t += STEP) busy[t] = rnd() < 0.38;
    return busy;
  }

  function minutesNow(now) {
    return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  }

  // Свободные окна дня, которые ещё не начались (с запасом 15 минут на дорогу)
  function freeSlots(date, now) {
    var busy = busySlots(date);
    var sameDay = date.toDateString() === now.toDateString();
    var from = sameDay ? minutesNow(now) + 15 : -1;
    var list = [];
    for (var t = HOURS.open; t < HOURS.close; t += STEP) {
      list.push({ t: t, free: !busy[t] && t > from });
    }
    return list;
  }

  function hhmm(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* ---------- Табло пит-стопа ---------- */

  if (board) {
    var timeEl = board.querySelector('[data-board-time]');
    var labelEl = board.querySelector('[data-board-label]');
    var slotsEl = board.querySelector('[data-board-slots]');

    var tickBoard = function () {
      var now = new Date();
      var free = freeSlots(now, now).filter(function (s) { return s.free; });
      slotsEl.textContent = String(free.length);
      if (!free.length) {
        // Сегодня окон нет: показываем время открытия
        board.classList.add('is-closed');
        labelEl.textContent = board.dataset.closed;
        timeEl.textContent = hhmm(HOURS.open);
        return;
      }
      board.classList.remove('is-closed');
      labelEl.textContent = board.dataset.next;
      var left = Math.max(0, Math.round((free[0].t - minutesNow(now)) * 60));
      var h = Math.floor(left / 3600);
      var mm = Math.floor((left % 3600) / 60);
      var ss = left % 60;
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      timeEl.textContent = (h ? h + ':' + pad(mm) : pad(mm)) + ':' + pad(ss);
    };
    tickBoard();
    setInterval(tickBoard, 1000);
  }

  /* ---------- Калькулятор ---------- */

  var calc = document.querySelector('[data-calc]');
  var calcData = readJson('calc-data');

  if (calc && calcData) {
    var range = calc.querySelector('#radius');
    var radiusOut = calc.querySelector('[data-radius-out]');
    var priceEl = calc.querySelector('[data-calc-price]');
    var timeOut = calc.querySelector('[data-calc-time]');
    var linesEl = calc.querySelector('[data-calc-lines]');
    var wheelBox = calc.querySelector('[data-calc-wheel]');
    var calcWheel = wheelBox.querySelector('.wheel');
    var extrasById = {};
    calcData.extras.forEach(function (e) { extrasById[e.id] = e; });
    var lastSummary = '';
    var wheelAngle = 0;

    // Цены округляем до 50 ₽, как на настоящем прайсе
    var round50 = function (v) { return Math.round(v / 50) * 50; };

    // Короткий поворот колеса при каждом изменении — «отклик» на действие
    var nudgeWheel = function () {
      if (reduced) return;
      var from = wheelAngle;
      var to = wheelAngle + 120;
      var start = performance.now();
      wheelAngle = to;
      var step = function (now) {
        var p = Math.min((now - start) / 700, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        rotateWheel(calcWheel, from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    var vehicleById = function (id) {
      return calcData.vehicles.filter(function (v) { return v.id === id; })[0] || calcData.vehicles[0];
    };

    var recalc = function () {
      var r = +range.value;
      var vehicle = vehicleById(calc.querySelector('input[name=vehicle]:checked').value);
      var k = vehicle.k;
      var lines = [];
      var total = round50(calcData.tireChange[r] * k);
      var minutes = calcData.baseTime * k;
      lines.push({ name: 'Шиномонтаж R' + r, price: total });

      calc.querySelectorAll('input[name=extra]:checked').forEach(function (input) {
        var e = extrasById[input.value];
        if (e.id === 'balancing') {
          var b = round50(calcData.balancing[r] * k);
          total += b;
          minutes += calcData.balancingTime;
          lines.push({ name: e.name, price: b });
          return;
        }
        minutes += e.time || 0;
        if (e.promoFree) {
          lines.push({ name: e.name, price: e.price, free: true });
          return;
        }
        total += e.price;
        lines.push({ name: e.name, price: e.price });
      });

      minutes = Math.round(minutes / 5) * 5;
      M.tweenNumber(priceEl, total, { duration: 600 });
      M.tweenNumber(timeOut, minutes, { duration: 600 });

      linesEl.innerHTML = '';
      lines.forEach(function (line) {
        var li = document.createElement('li');
        var name = document.createElement('span');
        var price = document.createElement('span');
        name.textContent = line.name;
        if (line.free) {
          price.className = 'is-free';
          price.innerHTML = '<s>' + rub(line.price) + ' ₽</s> ' + calcData.promoLabel;
        } else {
          price.textContent = rub(line.price) + ' ₽';
        }
        li.append(name, price);
        linesEl.appendChild(li);
      });

      // Размер колеса и заливка ползунка следуют за диаметром
      var share = (r - calcData.radius.min) / (calcData.radius.max - calcData.radius.min);
      wheelBox.style.setProperty('--s', (0.62 + share * 0.38).toFixed(3));
      range.style.setProperty('--fill', (share * 100).toFixed(1) + '%');
      radiusOut.textContent = 'R' + r;

      // Текст для формы: что посчитал человек
      var extras = lines.slice(1).map(function (l) { return l.name.toLowerCase(); });
      lastSummary = 'Расчёт на сайте: ' + vehicle.name.toLowerCase() + ', R' + r +
        (extras.length ? '; ' + extras.join(', ') : '') +
        '. Итого ≈ ' + rub(total) + ' ₽, ' + minutes + ' мин.';
    };

    calc.addEventListener('input', function () {
      recalc();
      nudgeWheel();
    });
    recalc();

    // «Записаться с этим расчётом»: выбираем услугу и переносим расчёт в комментарий
    calc.querySelector('[data-calc-cta]').addEventListener('click', function () {
      var form = document.querySelector('[data-lead-form]');
      if (!form) return;
      form.elements.service.value = 'tire-change';
      var comment = form.elements.comment;
      if (!comment.value.trim() || comment.value.indexOf('Расчёт на сайте:') === 0) {
        comment.value = lastSummary;
      }
    });
  }

  /* ---------- Маркировка шины ---------- */

  var tyre = document.querySelector('[data-tyre]');
  var tyreData = readJson('tyre-data');

  if (tyre && tyreData) {
    var chips = Array.prototype.slice.call(tyre.querySelectorAll('.chip'));
    var info = tyre.querySelector('.tyre__info');
    var labelOut = tyre.querySelector('[data-tyre-label]');
    var bigOut = tyre.querySelector('[data-tyre-big]');
    var textOut = tyre.querySelector('[data-tyre-text]');
    var autoplay = null;

    var partData = function (key) {
      return key === 'dot' ? tyreData.dot : tyreData.parts[+key];
    };

    var select = function (key) {
      var part = partData(key);
      if (!part) return;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.part === key)); });
      tyre.querySelectorAll('tspan[data-part]').forEach(function (t) {
        t.classList.toggle('is-on', t.dataset.part === key);
      });
      tyre.querySelectorAll('.dim').forEach(function (d) {
        d.classList.toggle('is-on', d.dataset.dim === part.dim);
      });
      labelOut.textContent = part.label;
      bigOut.textContent = part.big;
      textOut.textContent = part.text;
      info.classList.remove('is-swap');
      void info.offsetWidth; // перезапуск CSS-анимации
      info.classList.add('is-swap');
    };

    var stopAutoplay = function () {
      if (autoplay) clearInterval(autoplay);
      autoplay = null;
    };

    var onPick = function (key) {
      stopAutoplay();
      select(key);
    };

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { onPick(chip.dataset.part); });
    });
    // По самой надписи на боковине тоже можно кликать
    tyre.querySelectorAll('tspan[data-part]').forEach(function (t) {
      t.addEventListener('click', function () { onPick(t.dataset.part); });
    });

    select(chips[0].dataset.part);

    // Пока человек не нажал сам, части маркировки показываются по очереди
    if (!reduced) {
      M.onVisible(tyre, function () {
        var i = 0;
        autoplay = setInterval(function () {
          i = (i + 1) % chips.length;
          select(chips[i].dataset.part);
        }, 3200);
      }, 0.4);
    }
  }

  /* ---------- Трасса «Как записаться» ---------- */

  var track = document.querySelector('[data-track]');
  if (track) {
    var stepsSection = track.closest('section');
    M.onScroll(function () {
      var p = clamp((M.progressOf(stepsSection) - 0.15) / 0.45, 0, 1);
      track.style.setProperty('--p', p.toFixed(3));
    });
  }

  /* ---------- Выбор окна записи ---------- */

  var slots = document.querySelector('[data-slots]');
  var whenInput = document.getElementById('f-when');

  if (slots && whenInput) {
    var daysEl = slots.querySelector('[data-slots-days]');
    var timesEl = slots.querySelector('[data-slots-times]');
    var WEEK = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    var now = new Date();
    var days = [];
    for (var d = 0; d < 6; d++) {
      var date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      var list = freeSlots(date, now);
      // Сегодня без свободных окон не показываем
      if (d === 0 && !list.some(function (s) { return s.free; })) continue;
      days.push({ date: date, list: list });
    }

    var dayTitle = function (day, i) {
      var diff = Math.round((day.date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
      if (diff === 0) return 'Сегодня';
      if (diff === 1) return 'Завтра';
      return WEEK[day.date.getDay()];
    };

    var dateLabel = function (date) {
      var dd = date.getDate();
      var mm = date.getMonth() + 1;
      return (dd < 10 ? '0' : '') + dd + '.' + (mm < 10 ? '0' : '') + mm;
    };

    var activeDay = 0;

    var renderTimes = function () {
      var day = days[activeDay];
      timesEl.innerHTML = '';
      day.list.forEach(function (s) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot';
        btn.textContent = hhmm(s.t);
        btn.disabled = !s.free;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', function () {
          timesEl.querySelectorAll('.slot').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          btn.setAttribute('aria-pressed', 'true');
          whenInput.value = dayTitle(day) + ' ' + dateLabel(day.date) + ', ' + hhmm(s.t);
        });
        timesEl.appendChild(btn);
      });
    };

    days.forEach(function (day, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-day';
      btn.innerHTML = '<span></span><small></small>';
      btn.firstChild.textContent = dayTitle(day, i);
      btn.lastChild.textContent = dateLabel(day.date);
      btn.setAttribute('aria-pressed', String(i === 0));
      btn.addEventListener('click', function () {
        activeDay = i;
        daysEl.querySelectorAll('.slot-day').forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
        renderTimes();
      });
      daysEl.appendChild(btn);
    });

    // Если человек пишет время сам — снимаем выделение с кнопок
    whenInput.addEventListener('input', function () {
      timesEl.querySelectorAll('.slot').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    });

    if (days.length) {
      renderTimes();
      slots.hidden = false;
    }
  }
})();
