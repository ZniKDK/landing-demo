import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, pageByUrl } from './helpers/build.js';
import { jsonForScript } from '../lib/json-script.js';

const site = JSON.parse(readFileSync('site/_data/site.json', 'utf8'));

test('главная собирается и содержит title, description и демо-плашку', async () => {
  const home = pageByUrl(await buildPages(), '/');
  assert.ok(home, 'нет страницы /');
  assert.match(home.content, new RegExp(`<title>${site.seo.title}</title>`));
  assert.ok(home.content.includes(`content="${site.seo.description}"`));
  assert.ok(home.content.includes(site.demoNotice));
});

test('главная содержит все секции из site.sections в нужном порядке', async () => {
  const html = pageByUrl(await buildPages(), '/').content;
  let lastIndex = -1;
  for (const id of site.sections) {
    const index = html.indexOf(`id="${id}"`);
    assert.ok(index > lastIndex, `секция ${id} отсутствует или стоит не по порядку`);
    lastIndex = index;
  }
});

test('форма: все поля, honeypot, согласие, варианты услуг', async () => {
  const html = pageByUrl(await buildPages(), '/').content;
  for (const name of ['name', 'phone', 'car', 'service', 'when', 'comment', 'consent', 'website', 'elapsed']) {
    assert.ok(html.includes(`name="${name}"`), `нет поля ${name}`);
  }
  for (const s of site.services) assert.ok(html.includes(`value="${s.id}"`), s.id);
  assert.ok(html.includes('value="other"'));
  assert.ok(html.includes('data-lead-form'));
});

test('каждая секция исчезает, если убрать её из site.sections', async () => {
  // Проверяем шаблонность: порядок задаётся только данными
  const html = pageByUrl(await buildPages(), '/').content;
  assert.equal((html.match(/<section /g) || []).length, site.sections.length);
});

test('SEO главной: canonical, Open Graph, JSON-LD AutoRepair', async () => {
  const html = pageByUrl(await buildPages(), '/').content;
  assert.ok(html.includes(`<link rel="canonical" href="${site.url}">`));
  assert.ok(html.includes('property="og:title"'));
  assert.ok(html.includes('property="og:locale" content="ru_RU"'));
  const ld = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s);
  assert.ok(ld, 'нет JSON-LD');
  const data = JSON.parse(ld[1]);
  assert.equal(data['@type'], 'AutoRepair');
  assert.equal(data.telephone, site.contact.phone);
});

test('служебные страницы: политика, спасибо (noindex), robots, sitemap', async () => {
  const pages = await buildPages();
  assert.ok(pageByUrl(pages, '/privacy/').content.includes('152-ФЗ'));
  assert.ok(pageByUrl(pages, '/thanks/').content.includes('name="robots" content="noindex"'));
  assert.ok(pageByUrl(pages, '/robots.txt').content.includes(`Sitemap: ${site.url}sitemap.xml`));
  const sitemap = pageByUrl(pages, '/sitemap.xml').content;
  assert.ok(sitemap.includes(`<loc>${site.url}</loc>`));
  assert.ok(sitemap.includes(`<loc>${site.url}privacy/</loc>`));
  assert.ok(!sitemap.includes('thanks'));
});

// Ревью, Important 1: на Pages HtmlBasePlugin превращает action="" в action=".",
// и form.js не узнаёт демо-режим. Без адреса функции атрибута action быть не должно.
test('форма без адреса функции не получает атрибут action', async () => {
  const html = pageByUrl(await buildPages(), '/').content;
  const formTag = html.match(/<form[^>]*data-lead-form[^>]*>/)[0];
  assert.ok(!/\saction=/.test(formTag), formTag);
});

// Ревью, Minor 1: кнопка «Записаться» в шапке должна работать и на других страницах
test('кнопка записи в шапке ведёт на форму главной с любой страницы', async () => {
  const privacy = pageByUrl(await buildPages(), '/privacy/').content;
  assert.ok(privacy.includes('class="btn btn--primary header__cta" href="/#form"'));
});

// Ревью, Minor 5: без JS браузер сам проверяет обязательные поля — novalidate ставит form.js
test('в разметке формы нет novalidate', async () => {
  const html = pageByUrl(await buildPages(), '/').content;
  assert.ok(!/<form[^>]*novalidate/.test(html));
});

// Ревью, Minor 8: "</script>" в тексте из site.json не должен закрыть тег микроразметки
test('jsonForScript экранирует "<", JSON при этом читается как прежде', () => {
  const out = jsonForScript({ name: 'А</script><b>' });
  assert.ok(!out.includes('<'));
  assert.deepEqual(JSON.parse(out), { name: 'А</script><b>' });
});

test('первый экран: фото с размерами и приоритетом, og:image для соцсетей', async () => {
  const html = pageByUrl(await buildPages(), '/').content;
  assert.match(html, /<img src="\/assets\/img\/hero-800\.webp"[^>]*width="800" height="600"[^>]*fetchpriority="high"/);
  assert.ok(html.includes('hero-1600.webp 1600w'));
  assert.ok(html.includes(`<meta property="og:image" content="${site.url}assets/img/og.jpg">`));
});
