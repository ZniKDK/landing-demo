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
