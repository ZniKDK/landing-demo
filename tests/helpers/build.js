// Собирает сайт в памяти (без записи на диск) и возвращает страницы Eleventy
import * as eleventyModule from '@11ty/eleventy';

const Eleventy = eleventyModule.Eleventy ?? eleventyModule.default;

export async function buildPages() {
  const elev = new Eleventy('site', '_site', { configPath: 'eleventy.config.js', quietMode: true });
  return elev.toJSON();
}

// Ищет страницу по URL ('/', '/privacy/' ...)
export function pageByUrl(pages, url) {
  return pages.find((p) => p.url === url);
}
