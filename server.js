// Piccolo server per provare l'app nel browser: node server.js  →  http://localhost:5173
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = 5173;
const TIPI = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

http.createServer((req, res) => {
  const percorso = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(__dirname, percorso === '/' ? 'index.html' : percorso);
  if (!file.startsWith(__dirname)) return res.writeHead(403).end();
  fs.readFile(file, (err, contenuto) => {
    if (err) return res.writeHead(404).end('Non trovato');
    res.writeHead(200, { 'Content-Type': (TIPI[path.extname(file)] ?? 'application/octet-stream') + '; charset=utf-8' });
    res.end(contenuto);
  });
}).listen(PORTA, () => console.log(`App su http://localhost:${PORTA}`));
