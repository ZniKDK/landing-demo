// Копирует список услуг из site/_data/site.json в function/core/services.json.
// Функция загружается в облако отдельно от сайта, поэтому ей нужна своя копия списка:
// по нему сервер проверяет, что выбранная услуга существует.
// Тест tests/services.test.js падает, если копию забыли обновить.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function buildServices(site) {
  return [
    ...site.services.map(({ id, name }) => ({ id, name })),
    { id: 'other', name: site.form.otherOption },
  ];
}

// Запуск напрямую: npm run sync:services
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = JSON.parse(readFileSync('site/_data/site.json', 'utf8'));
  writeFileSync('function/core/services.json', JSON.stringify(buildServices(site), null, 2) + '\n');
  console.log('function/core/services.json обновлён');
}
