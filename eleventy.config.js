// Настройки сборки сайта Eleventy.
// Исходники лежат в site/, готовый сайт — в _site/.
import { HtmlBasePlugin } from '@11ty/eleventy';

export default function (eleventyConfig) {
  // Добавляет префикс /landing-demo/ ко всем ссылкам вида "/..." при сборке для GitHub Pages
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Файлы, которые копируются в сайт без обработки
  eleventyConfig.addPassthroughCopy({ 'site/assets': 'assets' });

  // Полный адрес страницы: absUrl('/privacy/', 'https://site.ru/landing-demo/') → https://site.ru/landing-demo/privacy/
  eleventyConfig.addFilter('absUrl', (path, base) =>
    new URL(String(path).replace(/^\//, ''), base).href);

  return {
    dir: { input: 'site', output: '_site', includes: '_includes', data: '_data' },
    templateFormats: ['njk'],
    htmlTemplateEngine: 'njk',
    // В CI сюда приходит "/landing-demo/", локально — корень
    pathPrefix: process.env.PATH_PREFIX || '/',
  };
}
