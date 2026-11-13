// Regole delle faccende (in quali giorni cadono, cosa c'è da fare oggi, cosa è in ritardo)
// e della lista della spesa (cosa si vede e cosa va archiviato).
// Funzioni pure: lavorano sulle righe che ricevono, senza leggere o salvare dati.
// Le date sono stringhe locali "AAAA-MM-GG", confrontabili come testo.

export const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
export const ORDINE_SETTIMANA = [1, 2, 3, 4, 5, 6, 0];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const due = n => String(n).padStart(2, '0');

export function dataLocale(d = new Date()) {
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

function daStringa(s) {
  const [a, m, g] = s.split('-').map(Number);
  return new Date(a, m - 1, g);
}

export function aggiungiGiorni(s, n) {
  const d = daStringa(s);
  d.setDate(d.getDate() + n);
  return dataLocale(d);
}

// Solo per le prove: "?oggi=AAAA-MM-GG" nell'indirizzo simula un altro giorno.
export function oggi() {
  const simulato = new URLSearchParams(location.search).get('oggi') ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(simulato) ? simulato : dataLocale();
}

export function dataBreve(s) {
  const d = daStringa(s);
  return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function dataLunga(s) {
  const d = daStringa(s);
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function dataOra(iso) {
  const d = new Date(iso);
  return `${dataBreve(dataLocale(d))} alle ${due(d.getHours())}:${due(d.getMinutes())}`;
}

// ---------- Mese del calendario ----------

export function nomeMese(giorno) {
  const d = daStringa(giorno);
  return `${MESI_LUNGHI[d.getMonth()]} ${d.getFullYear()}`;
}

// Il primo giorno del mese che sta "passo" mesi prima (-1) o dopo (+1) quello del giorno dato.
export function primoDelMese(giorno, passo = 0) {
  const d = daStringa(giorno.slice(0, 8) + '01');
  d.setMonth(d.getMonth() + passo);
  return dataLocale(d);
}

// Le caselle del mese che contiene il giorno, a settimane da lunedì: null per i buchi iniziali.
export function grigliaMese(giorno) {
  const primo = primoDelMese(giorno);
  const caselle = Array((daStringa(primo).getDay() + 6) % 7).fill(null);
  for (let g = primo; g.slice(0, 7) === primo.slice(0, 7); g = aggiungiGiorni(g, 1)) caselle.push(g);
  return caselle;
}

export function cadeIl(faccenda, giorno) {
  const p = faccenda.programmazione;
  return p.tipo === 'settimanale' ? p.giorni.includes(daStringa(giorno).getDay()) : p.data === giorno;
}

export function descriviProgrammazione(p) {
  if (p.tipo === 'una_volta') return `Una volta, ${dataLunga(p.data)}`;
  if (p.giorni.length === 7) return 'Ogni giorno';
  return 'Ogni ' + ORDINE_SETTIMANA.filter(g => p.giorni.includes(g)).map(g => GIORNI[g]).join(', ');
}

export function prossimaData(faccenda, da) {
  const p = faccenda.programmazione;
  if (p.tipo === 'una_volta') return p.data >= da ? p.data : null;
  for (let i = 0; i < 7; i++) {
    const g = aggiungiGiorni(da, i);
    if (cadeIl(faccenda, g)) return g;
  }
  return null;
}

// Cosa resta da fare per una faccenda nel giorno indicato, oppure null.
// - Il ritardo si conta solo dal giorno in cui la faccenda è stata creata (o riprogrammata).
// - Le volte saltate diventano un'unica voce, "in ritardo dal" la più vecchia.
// - Un completamento azzera tutto ciò che c'era prima della data a cui si riferisce.
export function daFare(faccenda, completamenti, giorno) {
  const suoi = completamenti.filter(c => c.faccendaId === faccenda.id);
  const fatta = g => suoi.some(c => c.dataPrevista === g);
  const ultimaFatta = suoi.map(c => c.dataPrevista).filter(g => g <= giorno).sort().at(-1);

  let da = faccenda.inizio;
  if (ultimaFatta && ultimaFatta >= da) da = aggiungiGiorni(ultimaFatta, 1);

  const saltate = [];
  const p = faccenda.programmazione;
  if (p.tipo === 'una_volta') {
    if (p.data >= da && p.data < giorno && !fatta(p.data)) saltate.push(p.data);
  } else {
    for (let g = da; g < giorno; g = aggiungiGiorni(g, 1)) {
      if (cadeIl(faccenda, g) && !fatta(g)) saltate.push(g);
    }
  }

  const toccaOggi = cadeIl(faccenda, giorno) && !fatta(giorno);
  if (!saltate.length && !toccaOggi) return null;
  return {
    faccenda,
    ritardoDal: saltate[0] ?? null,
    // La data che il completamento coprirà: oggi se tocca oggi, altrimenti l'ultima saltata.
    dataPrevista: toccaOggi ? giorno : saltate.at(-1),
  };
}

// ---------- Lista della spesa ----------
// Ogni voce: { id, nome, aggiuntaIl (ISO), spuntataIl ("AAAA-MM-GG" o null), archiviata }.
// Una voce spuntata resta visibile, barrata, solo nel giorno in cui è stata spuntata;
// dal giorno dopo va archiviata (non cancellata).

const normalizza = s => String(s).trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');

export function stessoNome(a, b) {
  return normalizza(a) === normalizza(b);
}

// Le voci da mostrare nel giorno indicato, in due gruppi: da comprare e comprate quel giorno.
export function listaSpesa(voci, giorno) {
  const perAggiunta = (a, b) => a.aggiuntaIl.localeCompare(b.aggiuntaIl);
  const visibili = voci.filter(v => !v.archiviata);
  return {
    daComprare: visibili.filter(v => !v.spuntataIl).sort(perAggiunta),
    comprate: visibili.filter(v => v.spuntataIl === giorno).sort(perAggiunta),
  };
}

// Le voci spuntate in un giorno precedente e non ancora archiviate.
export function daArchiviare(voci, giorno) {
  return voci.filter(v => !v.archiviata && v.spuntataIl && v.spuntataIl < giorno);
}
