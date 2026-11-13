// Aula 01 — chat simples com Ollama (Node.js 18+).
// O servidor entrega a página e repassa a chamada ao Ollama.
// A requisição via /api/chat evita problemas de CORS no navegador.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORTA = 3001;
const URL_OLLAMA = 'http://localhost:11434/api/chat';
const arquivos = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/script.js': ['script.js', 'text/javascript; charset=utf-8']
};

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    try {
      let body = '';
      for await (const part of req) {
        body += part;
        if (body.length > 200_000) {
          res.writeHead(413); res.end('Requisição muito grande'); return;
        }
      }
      const resultado = await fetch(URL_OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(120_000)
      });
      res.writeHead(resultado.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(await resultado.text());
    } catch (erro) {
      res.writeHead(502, {'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({erro: 'Não foi possível acessar o Ollama: ' + erro.message}));
    }
    return;
  }
  const entrada = arquivos[req.url];
  if (req.method !== 'GET' || !entrada) { res.writeHead(404); res.end('Não encontrado'); return; }
  try {
    res.writeHead(200, { 'Content-Type': entrada[1] });
    res.end(await fs.readFile(path.join(__dirname, entrada[0])));
  } catch {
    res.writeHead(500); res.end('Erro ao ler a página');
  }
}).listen(PORTA, () => console.log('Aula 01: http://localhost:' + PORTA));
