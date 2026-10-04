import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildServices } from '../scripts/sync-services.mjs';

test('function/core/services.json совпадает с услугами из site.json', () => {
  const site = JSON.parse(readFileSync('site/_data/site.json', 'utf8'));
  const actual = JSON.parse(readFileSync('function/core/services.json', 'utf8'));
  assert.deepEqual(actual, buildServices(site),
    'Услуги изменились — выполните npm run sync:services');
});

test('buildServices добавляет вариант «Другое» последним', () => {
  const list = buildServices({ services: [{ id: 'a', name: 'А', price: '1' }], form: { otherOption: 'Другое' } });
  assert.deepEqual(list, [{ id: 'a', name: 'А' }, { id: 'other', name: 'Другое' }]);
});
