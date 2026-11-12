// Unico punto di accesso ai dati dell'app.
// Ogni "tabella" (coinquilini, faccende, completamenti) è un elenco di righe con un id,
// come in un database. Oggi le righe stanno nel localStorage del dispositivo; per passare
// a un database online basta riscrivere queste funzioni con chiamate al server,
// mantenendo gli stessi nomi e gli stessi risultati (sono già asincrone).

const PREFISSO = 'coinquilini.v1.';

function leggi(tabella) {
  try {
    return JSON.parse(localStorage.getItem(PREFISSO + tabella)) ?? [];
  } catch {
    return [];
  }
}

function scrivi(tabella, righe) {
  localStorage.setItem(PREFISSO + tabella, JSON.stringify(righe));
}

export function nuovoId() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function elenco(tabella) {
  return leggi(tabella);
}

export async function inserisci(tabella, campi) {
  const riga = { id: nuovoId(), ...campi };
  scrivi(tabella, [...leggi(tabella), riga]);
  return riga;
}

export async function aggiorna(tabella, id, campi) {
  scrivi(tabella, leggi(tabella).map(r => (r.id === id ? { ...r, ...campi } : r)));
}

export async function elimina(tabella, id) {
  scrivi(tabella, leggi(tabella).filter(r => r.id !== id));
}

// Al primo avvio carica i dati di partenza; poi non li tocca più.
export async function inizializzaSeVuoto(datiIniziali) {
  if (localStorage.getItem(PREFISSO + 'inizializzato')) return;
  for (const [tabella, righe] of Object.entries(datiIniziali)) scrivi(tabella, righe);
  localStorage.setItem(PREFISSO + 'inizializzato', new Date().toISOString());
}
