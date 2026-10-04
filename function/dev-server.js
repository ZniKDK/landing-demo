'use strict';
// Локальный запуск функции без облака: npm run dev:function
// Превращает обычный HTTP-запрос в event Yandex Cloud Functions и обратно.
// Только для разработки, в облако этот файл не нужен.
const http = require('node:http');
const { createHandler, createDefaultDeps } = require('./index');

const PORT = Number(process.env.PORT) || 8787;
const handle = createHandler(createDefaultDeps(process.env));

http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      body: Buffer.concat(chunks).toString('utf8'),
      isBase64Encoded: false,
    };
    const out = await handle(event);
    res.writeHead(out.statusCode, out.headers);
    res.end(out.body);
  });
}).listen(PORT, () => console.log(`Функция слушает http://localhost:${PORT}`));
