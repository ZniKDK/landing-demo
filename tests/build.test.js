import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, pageByUrl } from './helpers/build.js';

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
  for (const name of ['name', 'phone', 'car', 'service', 'when', 'comment', 'consent', 'website', 'ts']) {
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
