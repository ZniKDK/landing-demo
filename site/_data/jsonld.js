// Микроразметка schema.org для поисковиков: Яндекс и Google показывают адрес, телефон и часы в выдаче.
// Данные берутся из site.json, отдельно ничего заполнять не нужно.
import { readFileSync } from 'node:fs';

const site = JSON.parse(readFileSync(new URL('./site.json', import.meta.url), 'utf8'));

export default {
  '@context': 'https://schema.org',
  '@type': 'AutoRepair',
  name: site.name,
  description: site.seo.description,
  url: site.url,
  telephone: site.contact.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: site.contact.street,
    addressLocality: site.contact.city,
    addressCountry: 'RU',
  },
  openingHours: site.contact.hoursSchema,
};
