// Данные, которые вычисляются при сборке, а не хранятся в site.json
export default {
  year: new Date().getFullYear(),
  // Адрес функции можно подменить при локальной разработке: FORM_ENDPOINT=http://localhost:8787 npm start
  formEndpoint: process.env.FORM_ENDPOINT || '',
};
