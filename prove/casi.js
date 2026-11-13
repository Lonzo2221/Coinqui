// I casi di prova della lista della spesa. Girano in un browser vero, lanciati da prove/esegui.js:
// aprono l'app in un iframe, scrivono e cliccano come una persona, poi controllano schermo e dati.
// I dati si preparano e si leggono solo tramite js/storage.js, come nel resto dell'app.
import * as db from '../js/storage.js';

const GIORNO = '2026-11-13'; // venerdì
const DOPO = '2026-11-14';   // sabato, il giorno di "Fare la spesa"

const frame = document.getElementById('app');
const doc = () => frame.contentDocument;
let aperture = 0;

// ---------- Attrezzi ----------

function verifica(condizione, messaggio) {
  if (!condizione) throw new Error(messaggio);
}

async function attendi(condizione, cosa, ms = 4000) {
  const fine = Date.now() + ms;
  for (;;) {
    try { if (await condizione()) return; } catch { /* la pagina si sta ancora disegnando */ }
    if (Date.now() > fine) throw new Error(`tempo scaduto: ${cosa}`);
    await new Promise(r => setTimeout(r, 20));
  }
}

const titolo = () => doc().getElementById('titolo')?.textContent;
const disegnata = () => doc().getElementById('contenuto')?.childElementCount > 0;

// Apre l'app da capo (come ricaricare la pagina) nel giorno e nella sezione indicati.
async function apri(giorno, sezione, titoloAtteso) {
  const caricata = new Promise(r => { frame.onload = r; });
  frame.src = `/index.html?oggi=${giorno}&apertura=${++aperture}#${sezione}`;
  await caricata;
  await attendi(() => titolo() === titoloAtteso && disegnata(), `apertura di #${sezione}`);
}

// Cambia sezione senza ricaricare, come toccando il menu.
async function vai(sezione, titoloAtteso) {
  frame.contentWindow.location.hash = sezione;
  await attendi(() => titolo() === titoloAtteso && disegnata(), `passaggio a #${sezione}`);
}

function evento(elemento, tipo) {
  elemento.dispatchEvent(new frame.contentWindow.Event(tipo, { bubbles: true }));
}

// Le righe della lista della spesa come si vedono sullo schermo, dall'alto in basso:
// prima il blocco "Da comprare", poi il blocco "Comprate oggi".
function righe() {
  return [...doc().querySelectorAll('#da-comprare > li, #comprate > li')].map(li => {
    const nome = li.querySelector('.nome-voce');
    return {
      li,
      nome: nome.value ?? nome.textContent,
      comprata: li.classList.contains('fatta'),
      barrata: nome.classList.contains('barrato'),
      blocco: li.parentElement.id,
    };
  });
}
// Es. ["pane", "latte ✓"]: ✓ vuol dire spuntata (barrata).
const nomi = () => JSON.stringify(righe().map(r => r.nome + (r.comprata ? ' ✓' : '')));
const atteso = lista => JSON.stringify(lista);
const errore = () => doc().getElementById('errore-spesa');

async function aggiungi(nome) {
  const prima = righe().length;
  const campo = doc().querySelector('#nuova-voce input');
  campo.value = nome;
  evento(campo, 'input');
  campo.form.requestSubmit();
  await attendi(() => righe().length > prima || !errore().hidden, `aggiunta di "${nome}"`);
}

async function spunta(nome) {
  const riga = righe().find(r => r.nome === nome);
  verifica(riga, `"${nome}" non è nella lista`);
  const prima = riga.comprata;
  riga.li.querySelector('.spunta').click();
  await attendi(() => righe().find(r => r.nome === nome)?.comprata === !prima, `spunta di "${nome}"`);
}

const spesaSalvata = () => db.elenco('spesa');

// Dati di partenza noti, uguali per ogni caso.
function datiProva() {
  const faccenda = (id, titolo, giorni) => ({
    id, titolo, assegnataA: null, programmazione: { tipo: 'settimanale', giorni },
    inizio: DOPO, creataIl: '2026-11-01T10:00:00.000Z', archiviata: false, collegataSpesa: false,
  });
  return {
    coinquilini: [
      { id: 'c-lorenzo', nome: 'Lorenzo', archiviato: false },
      { id: 'c-marco', nome: 'Marco', archiviato: false },
      { id: 'c-giulia', nome: 'Giulia', archiviato: false },
    ],
    faccende: [
      faccenda('f-spesa', 'Fare la spesa', [6]),
      faccenda('f-piatti', 'Lavare i piatti', [0, 1, 2, 3, 4, 5, 6]),
    ],
    completamenti: [],
    spesa: [],
  };
}

// ---------- I casi ----------

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. Aggiungo "latte" e "pane", ricarico: ci sono ancora, non spuntati', async () => {
  await apri(GIORNO, 'spesa', 'Spesa');
  await aggiungi('latte');
  await aggiungi('pane');
  verifica(nomi() === atteso(['latte', 'pane']), `prima di ricaricare la lista è ${nomi()}`);
  await apri(GIORNO, 'spesa', 'Spesa');
  verifica(nomi() === atteso(['latte', 'pane']), `dopo aver ricaricato la lista è ${nomi()}`);
  const dati = await spesaSalvata();
  verifica(dati.length === 2 && dati.every(v => v.spuntataIl === null), 'nei dati non ci sono 2 voci non spuntate');
});

caso('2. Spunto "latte": va in fondo, barrato, in "Comprate oggi". Tolgo la spunta: torna su, normale', async () => {
  await apri(GIORNO, 'spesa', 'Spesa');
  await aggiungi('latte');
  await aggiungi('pane');
  verifica(!doc().getElementById('comprate'), 'c\'è il blocco "Comprate oggi" senza niente di comprato');
  await spunta('latte');
  verifica(nomi() === atteso(['pane', 'latte ✓']), `dopo la spunta la lista è ${nomi()}`);
  verifica(righe()[1].barrata, '"latte" spuntato non è barrato');
  verifica(righe()[0].blocco === 'da-comprare' && righe()[1].blocco === 'comprate',
    '"latte" spuntato non è separato da "pane" da comprare');
  const titoli = [...doc().querySelectorAll('#contenuto h2')].map(h => h.textContent);
  verifica(atteso(titoli) === atteso(['Da comprare', 'Comprate oggi']), `i titoli dei blocchi sono ${atteso(titoli)}`);
  await spunta('latte');
  verifica(nomi() === atteso(['latte', 'pane']), `dopo aver tolto la spunta la lista è ${nomi()}`);
  verifica(!righe()[0].barrata, '"latte" è ancora barrato');
  verifica(!doc().getElementById('comprate'), 'il blocco "Comprate oggi" resta anche vuoto');
});

caso('3. Spunto "latte" il 13; il 14 non c\'è più, "pane" sì, e "latte" è archiviato nei dati', async () => {
  await apri(GIORNO, 'spesa', 'Spesa');
  await aggiungi('latte');
  await aggiungi('pane');
  await spunta('latte');
  await apri(DOPO, 'spesa', 'Spesa');
  verifica(nomi() === atteso(['pane']), `il 14 la lista è ${nomi()}`);
  const dati = await spesaSalvata();
  const latte = dati.find(v => v.nome === 'latte');
  const pane = dati.find(v => v.nome === 'pane');
  verifica(latte, '"latte" non c\'è più nei dati: è stato cancellato');
  verifica(latte.archiviata === true, '"latte" nei dati non è archiviato');
  verifica(latte.spuntataIl === GIORNO, `"latte" risulta spuntato il ${latte.spuntataIl}`);
  verifica(pane.archiviata === false, '"pane" è stato archiviato per sbaglio');
});

caso('4. Il 13 spunto "latte" e tolgo subito la spunta; il 14 c\'è ancora, non spuntato', async () => {
  await apri(GIORNO, 'spesa', 'Spesa');
  await aggiungi('latte');
  await aggiungi('pane');
  await spunta('latte');
  await spunta('latte');
  await apri(DOPO, 'spesa', 'Spesa');
  verifica(nomi() === atteso(['latte', 'pane']), `il 14 la lista è ${nomi()}`);
  const latte = (await spesaSalvata()).find(v => v.nome === 'latte');
  verifica(latte.spuntataIl === null && latte.archiviata === false, '"latte" nei dati è spuntato o archiviato');
});

caso('5. "Fare la spesa" collegata: solo lei ha "Apri la lista"; fatta da Marco va nello storico, la lista non cambia', async () => {
  await apri(DOPO, 'spesa', 'Spesa');
  await aggiungi('latte');

  // In Gestione la collego alla lista.
  await vai('gestione', 'Gestione');
  doc().querySelector('a[href="#faccenda/f-spesa"]').click();
  await attendi(() => titolo() === 'Modifica faccenda', 'apertura del modulo della faccenda');
  const casella = doc().querySelector('[name="collegataSpesa"]');
  verifica(casella && !casella.checked, 'manca la casella "Collegata alla lista della spesa"');
  casella.click();
  doc().getElementById('modulo-faccenda').requestSubmit();
  await attendi(() => titolo() === 'Gestione' && disegnata(), 'ritorno in Gestione dopo il salvataggio');
  const salvata = (await db.elenco('faccende')).find(f => f.id === 'f-spesa');
  verifica(salvata.collegataSpesa === true, 'nei dati la faccenda non risulta collegata');

  // In Oggi solo lei ha il tasto, e il tasto apre la Spesa.
  await vai('oggi', 'Oggi');
  const schede = [...doc().querySelectorAll('#contenuto li.card')].map(li => ({
    titolo: li.querySelector('strong').textContent, tasto: li.querySelector('.apri-lista'),
  }));
  verifica(schede.length >= 2, 'in Oggi mancano le faccende da fare');
  const conTasto = schede.filter(s => s.tasto).map(s => s.titolo);
  verifica(atteso(conTasto) === atteso(['Fare la spesa']), `"Apri la lista" compare su: ${atteso(conTasto)}`);
  schede.find(s => s.tasto).tasto.click();
  await attendi(() => titolo() === 'Spesa' && disegnata(), 'apertura della Spesa dal tasto');
  verifica(nomi() === atteso(['latte']), `la Spesa aperta dal tasto mostra ${nomi()}`);

  // La segno fatta scegliendo Marco.
  const spesaPrima = atteso(await spesaSalvata());
  await vai('oggi', 'Oggi');
  doc().querySelector('[data-fatta="f-spesa"]').click();
  const dialogo = doc().getElementById('dialogo');
  await attendi(() => dialogo.open, 'apertura di "Chi l\'ha fatta?"');
  [...dialogo.querySelectorAll('button')].find(b => b.textContent.trim() === 'Marco').click();
  await attendi(() => !doc().querySelector('[data-fatta="f-spesa"]'), '"Fare la spesa" che sparisce da Da fare');
  const completamenti = await db.elenco('completamenti');
  verifica(completamenti.length === 1 && completamenti[0].faccendaId === 'f-spesa' && completamenti[0].fattaDa === 'c-marco',
    'nei dati il completamento non è di Marco per "Fare la spesa"');
  await vai('persona/c-marco', 'Marco');
  verifica(doc().getElementById('storico')?.textContent.includes('Fare la spesa'), 'nello storico di Marco non c\'è "Fare la spesa"');
  verifica(atteso(await spesaSalvata()) === spesaPrima, 'la lista della spesa è cambiata');
});

caso('6. Senza faccende collegate la Spesa funziona normalmente', async () => {
  await apri(DOPO, 'oggi', 'Oggi');
  verifica(doc().querySelectorAll('#contenuto li.card').length >= 2, 'in Oggi mancano le faccende da fare');
  verifica(!doc().querySelector('.apri-lista'), 'c\'è un "Apri la lista" anche senza faccende collegate');
  await vai('spesa', 'Spesa');
  verifica(doc().querySelector('.vuoto')?.textContent.includes('La lista è vuota'), 'manca il messaggio di lista vuota');
  await aggiungi('latte');
  await spunta('latte');
  verifica(nomi() === atteso(['latte ✓']), `la lista è ${nomi()}`);
});

caso('In più: un doppione dice "Già presente" (anche se è già comprato oggi); il giorno dopo si riaggiunge', async () => {
  await apri(GIORNO, 'spesa', 'Spesa');
  await aggiungi('latte');
  await aggiungi('  Latte ');
  verifica(!errore().hidden && errore().textContent === 'Già presente', 'con "latte" da comprare non dice "Già presente"');
  verifica(nomi() === atteso(['latte']), `dopo il doppione la lista è ${nomi()}`);
  evento(doc().querySelector('#nuova-voce input'), 'input');
  verifica(errore().hidden, '"Già presente" non sparisce quando si riscrive');
  await spunta('latte');
  await aggiungi('latte');
  verifica(!errore().hidden, 'con "latte" comprato oggi non dice "Già presente"');
  verifica(nomi() === atteso(['latte ✓']), `dopo il doppione la lista è ${nomi()}`);
  await apri(DOPO, 'spesa', 'Spesa');
  await aggiungi('latte');
  verifica(errore().hidden && nomi() === atteso(['latte']), `il giorno dopo la lista è ${nomi()}`);
  verifica((await spesaSalvata()).filter(v => v.nome === 'latte').length === 2, 'nei dati non ci sono i due "latte"');
});

caso('In più: toccando il nome lo si corregge ("lattte" → "latte"); vuoto torna com\'era', async () => {
  await apri(GIORNO, 'spesa', 'Spesa');
  await aggiungi('lattte');
  const campo = righe()[0].li.querySelector('input.nome-voce');
  verifica(campo, 'il nome non si può modificare');
  campo.value = 'latte';
  evento(campo, 'change');
  await attendi(async () => (await spesaSalvata())[0].nome === 'latte', 'salvataggio del nome corretto');
  await apri(GIORNO, 'spesa', 'Spesa');
  verifica(nomi() === atteso(['latte']), `dopo aver ricaricato la lista è ${nomi()}`);
  const dopo = righe()[0].li.querySelector('input.nome-voce');
  dopo.value = '   ';
  evento(dopo, 'change');
  await attendi(() => dopo.value === 'latte', 'ritorno del nome di prima');
  verifica((await spesaSalvata())[0].nome === 'latte', 'nei dati il nome è stato svuotato');
});

caso('Calendario: griglia del mese con i pallini; toccando un giorno compare sotto cosa c\'è', async () => {
  const LUNEDI = '2026-11-16';
  // Sabato 14 Marco ha fatto tutto (piatti e spesa); domenica 15 i piatti non li ha fatti nessuno.
  for (const faccendaId of ['f-piatti', 'f-spesa']) {
    await db.inserisci('completamenti', {
      faccendaId, dataPrevista: DOPO, ritardoDal: null, fattaDa: 'c-marco', fattaIl: '2026-11-14T19:30:00.000Z',
    });
  }
  await apri(LUNEDI, 'calendario', 'Calendario');
  const cella = g => doc().querySelector(`.cella[data-scegli-giorno="${g}"]`);
  const pallino = g => cella(g).querySelector('.pallino').classList;
  const scelto = () => doc().getElementById('giorno-scelto');
  const schedaScelta = titolo => [...scelto().querySelectorAll('li.card')]
    .find(li => li.querySelector('strong').textContent === titolo);
  const tocca = async (g, cosa) => {
    doc().querySelector(`[data-scegli-giorno="${g}"]`).click();
    await attendi(() => scelto()?.dataset.giorno === cosa, `scelta del giorno ${cosa}`);
  };

  // La griglia: novembre 2026, settimane da lunedì (il 1° è domenica, quindi 6 buchi prima).
  verifica(doc().getElementById('nome-mese').textContent === 'novembre 2026', 'il mese mostrato non è novembre 2026');
  const celle = [...doc().querySelector('.griglia').children];
  verifica(celle.length === 36 && celle[6].dataset.scegliGiorno === '2026-11-01', 'la griglia non parte da lunedì o non ha 30 giorni');
  verifica(cella(LUNEDI).classList.contains('oggi') && cella(LUNEDI).classList.contains('scelto'), 'all\'apertura oggi non è scelto');
  verifica(pallino(DOPO).contains('fatto'), 'il 14 (tutto fatto) non ha il pallino verde');
  verifica(pallino('2026-11-15').contains('saltato'), 'il 15 (piatti non fatti) non ha il pallino rosso');
  verifica(pallino('2026-11-17').contains('da-fare'), 'il 17 non ha il pallino "da fare"');
  verifica(pallino(GIORNO).length === 1, 'il 13 (prima che le faccende esistessero) ha un pallino');

  // Sotto la griglia: oggi col tasto Fatta; poi i prossimi 7 giorni, da domani.
  verifica(scelto().querySelector('h2').textContent.startsWith('Oggi') && schedaScelta('Lavare i piatti')?.querySelector('[data-fatta]'),
    'sotto la griglia non c\'è oggi col tasto Fatta');
  const prossimi = [...doc().querySelectorAll('#prossimi .giorno-cal')].map(s => s.dataset.giorno);
  verifica(atteso(prossimi) === atteso(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']),
    `i prossimi giorni sono ${atteso(prossimi)}`);

  // Tocco il 15 e il 14: compare cosa c'era, senza tasto Fatta.
  const passiPrima = frame.contentWindow.history.length;
  await tocca('2026-11-15', '2026-11-15');
  verifica(scelto().querySelector('h2').textContent.startsWith('Ieri'), 'il 15 non si chiama "Ieri"');
  verifica(schedaScelta('Lavare i piatti')?.textContent.includes('Non fatta'), 'il 15 i piatti non risultano "Non fatta"');
  verifica(!scelto().querySelector('[data-fatta]'), 'in un giorno passato c\'è il tasto Fatta');
  await tocca(DOPO, DOPO);
  verifica(schedaScelta('Lavare i piatti')?.textContent.includes('Fatta da Marco'), 'il 14 i piatti non risultano "Fatta da Marco"');
  verifica(cella(DOPO).classList.contains('scelto') && !cella(LUNEDI).classList.contains('scelto'), 'la cella scelta non è evidenziata');
  verifica(frame.contentWindow.history.length === passiPrima, 'ogni tocco aggiunge un passo a "indietro"');

  // Le frecce cambiano mese; tornando a novembre si torna su oggi.
  doc().querySelector('[aria-label="Mese prima"]').click();
  await attendi(() => doc().getElementById('nome-mese').textContent === 'ottobre 2026', 'passaggio a ottobre');
  verifica(scelto().dataset.giorno === '2026-10-01', 'in ottobre non è scelto il primo del mese');
  doc().querySelector('[aria-label="Mese dopo"]').click();
  await attendi(() => doc().getElementById('nome-mese').textContent === 'novembre 2026', 'ritorno a novembre');
  verifica(scelto().dataset.giorno === LUNEDI, 'tornando a novembre non è scelto oggi');

  // Ricaricando resta sul giorno scelto.
  await tocca('2026-11-15', '2026-11-15');
  frame.contentWindow.location.reload();
  await new Promise(r => { frame.onload = r; });
  await attendi(() => scelto()?.dataset.giorno === '2026-11-15', 'giorno scelto dopo aver ricaricato');

  // "Fatta" dal giorno scelto (oggi): scelgo Lorenzo, il pallino di oggi diventa verde.
  await tocca(LUNEDI, LUNEDI);
  schedaScelta('Lavare i piatti').querySelector('[data-fatta]').click();
  const dialogo = doc().getElementById('dialogo');
  await attendi(() => dialogo.open, 'apertura di "Chi l\'ha fatta?"');
  [...dialogo.querySelectorAll('button')].find(b => b.textContent.trim() === 'Lorenzo').click();
  await attendi(() => schedaScelta('Lavare i piatti')?.textContent.includes('Fatta da Lorenzo'), '"Fatta da Lorenzo" sotto la griglia');
  verifica(pallino(LUNEDI).contains('fatto'), 'dopo "Fatta" il pallino di oggi non è verde');
});

caso('In più: a 320px di larghezza il menu a 5 tasti ci sta', async () => {
  frame.style.width = '320px';
  try {
    await apri(GIORNO, 'spesa', 'Spesa');
    verifica(doc().documentElement.scrollWidth <= 320, 'la pagina scorre di lato');
    for (const a of doc().querySelectorAll('.nav a')) {
      verifica(a.scrollWidth <= a.clientWidth + 1, `la scritta "${a.textContent.trim()}" esce dal tasto`);
    }
  } finally {
    frame.style.width = '';
  }
});

// ---------- Avvio ----------

async function esegui() {
  const elenco = document.getElementById('risultati');
  // Sicurezza: su localhost:5173 ci sono i dati che usi davvero, e le prove li cancellerebbero.
  if (location.port !== '5174') {
    elenco.innerHTML = '<li class="ko">Lancia le prove con <code>node prove/esegui.js</code>: qui cancellerebbero i tuoi dati.</li>';
    return;
  }
  const risultati = [];
  for (const { nome, fn } of casi) {
    await db.svuotaTutto();
    await db.inizializzaSeVuoto(datiProva());
    try {
      await fn();
      risultati.push({ nome, ok: true });
    } catch (err) {
      risultati.push({ nome, ok: false, errore: err.message });
    }
    const r = risultati.at(-1);
    elenco.insertAdjacentHTML('beforeend', `<li class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✓' : '✗'} ${nome}${r.ok ? '' : ` — ${r.errore}`}</li>`);
  }
  await fetch('/risultati', { method: 'POST', body: JSON.stringify(risultati) });
}

esegui();
