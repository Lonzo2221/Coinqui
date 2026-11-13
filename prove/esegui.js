// Prove automatiche di Coinqui:  node prove/esegui.js
// Avvia l'app su un indirizzo a parte (porta 5174: i dati che usi su localhost:5173 non si toccano),
// la apre in Edge o Chrome nascosto con un profilo vuoto, fa girare prove/casi.js e stampa i risultati.
// Nessuna libreria: solo Node e un browser già installato.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const PORTA = 5174;
const RADICE = path.join(__dirname, '..');
const TEMPO_MASSIMO = 60_000;
const TIPI = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const sotto = (cartella, resto) => (cartella ? path.join(cartella, resto) : null);

function trovaBrowser() {
  const env = process.env;
  return [
    env.BROWSER, // per usarne uno diverso: imposta la variabile BROWSER col percorso
    sotto(env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    sotto(env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
    sotto(env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    sotto(env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    sotto(env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find(p => p && fs.existsSync(p));
}

let consegna;
const risultatiArrivati = new Promise(r => { consegna = r; });

const server = http.createServer((req, res) => {
  // La pagina delle prove manda qui i risultati quando ha finito.
  if (req.method === 'POST' && req.url === '/risultati') {
    let corpo = '';
    req.on('data', pezzo => { corpo += pezzo; });
    req.on('end', () => { res.end('ok'); consegna(JSON.parse(corpo)); });
    return;
  }
  const percorso = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(RADICE, percorso === '/' ? 'index.html' : percorso);
  if (!file.startsWith(RADICE)) return res.writeHead(403).end();
  fs.readFile(file, (err, contenuto) => {
    if (err) return res.writeHead(404).end('Non trovato');
    res.writeHead(200, {
      'Content-Type': (TIPI[path.extname(file)] ?? 'application/octet-stream') + '; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(contenuto);
  });
});

// Chiude il browser e aspetta che sia uscito davvero (al massimo 5 secondi),
// altrimenti Windows non lascia cancellare la cartella del profilo.
async function chiudiBrowser(processo) {
  const uscito = processo.exitCode !== null
    ? Promise.resolve()
    : new Promise(r => processo.once('exit', r));
  try {
    // Su Windows il browser apre altri processi: taskkill /T chiude anche quelli.
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
    else processo.kill();
  } catch { /* già chiuso */ }
  await Promise.race([uscito, new Promise(r => setTimeout(r, 5000))]);
  await new Promise(r => setTimeout(r, 300)); // i processi figli lasciano i file un attimo dopo
}

async function main() {
  const browser = trovaBrowser();
  if (!browser) {
    console.error('Non trovo né Edge né Chrome. Installane uno, oppure imposta BROWSER con il percorso del programma.');
    process.exit(2);
  }
  await new Promise((pronto, errore) => server.on('error', errore).listen(PORTA, pronto)).catch(err => {
    console.error(`Non riesco a usare la porta ${PORTA} (${err.code}). Forse delle prove sono ancora aperte?`);
    process.exit(2);
  });

  const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'coinqui-prove-'));
  const processo = spawn(browser, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu',
    `--user-data-dir=${profilo}`, `http://localhost:${PORTA}/prove/prove.html`,
  ], { stdio: 'ignore' });
  console.log(`Prove in corso con ${path.basename(browser)}...\n`);

  const scadenza = new Promise(r => setTimeout(() => r(null), TEMPO_MASSIMO));
  const risultati = await Promise.race([risultatiArrivati, scadenza]);

  await chiudiBrowser(processo);
  server.close();
  try { fs.rmSync(profilo, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* resta in TEMP */ }

  if (!risultati) {
    console.error(`✗ Le prove non sono finite entro ${TEMPO_MASSIMO / 1000} secondi.`);
    process.exit(1);
  }
  for (const r of risultati) console.log(r.ok ? `✓ ${r.nome}` : `✗ ${r.nome}\n    → ${r.errore}`);
  const fallite = risultati.filter(r => !r.ok).length;
  console.log(fallite
    ? `\n${fallite} prove fallite su ${risultati.length}.`
    : `\nTutte le ${risultati.length} prove sono passate.`);
  process.exit(fallite ? 1 : 0);
}

main();
