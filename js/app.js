import * as db from './storage.js';
import {
  oggi, aggiungiGiorni, dataLocale, dataBreve, dataLunga, dataOra,
  cadeIl, daFare, descriviProgrammazione, prossimaData, GIORNI_BREVI, ORDINE_SETTIMANA,
} from './logica.js';

const GIORNI_CALENDARIO = 28;

const contenuto = document.getElementById('contenuto');
const dialogo = document.getElementById('dialogo');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function datiIniziali() {
  const adesso = new Date().toISOString();
  const faccenda = (titolo, giorni) => ({
    id: db.nuovoId(), titolo, assegnataA: null,
    programmazione: { tipo: 'settimanale', giorni },
    inizio: dataLocale(), creataIl: adesso, archiviata: false,
  });
  return {
    coinquilini: ['Lorenzo', 'Marco', 'Giulia'].map(nome => ({ id: db.nuovoId(), nome, archiviato: false })),
    faccende: [
      faccenda('Pulire il bagno', [0]),
      faccenda('Buttare la spazzatura', [1, 3, 5]),
      faccenda('Fare la spesa', [6]),
      faccenda('Lavare i piatti', [0, 1, 2, 3, 4, 5, 6]),
      faccenda('Pulire i pavimenti', [4]),
      faccenda('Fare la lavatrice', [2]),
    ],
    completamenti: [],
  };
}

async function carica() {
  const [coinquilini, faccende, completamenti] = await Promise.all(
    ['coinquilini', 'faccende', 'completamenti'].map(db.elenco));
  return {
    coinquilini, faccende, completamenti,
    persone: coinquilini.filter(c => !c.archiviato),
    attive: faccende.filter(f => !f.archiviata),
  };
}

const nomeDi = (dati, id) => dati.coinquilini.find(c => c.id === id)?.nome ?? '—';
const titoloDi = (dati, id) => dati.faccende.find(f => f.id === id)?.titolo ?? '—';
const chi = (dati, f) => (f.assegnataA ? `Assegnata a ${esc(nomeDi(dati, f.assegnataA))}` : 'Libera, chiunque');

// Solo aspetto: tondo con l'iniziale del coinquilino (o una casetta se la faccenda è libera).
// Il colore dipende dalla posizione nell'elenco, così resta lo stesso per ciascuno.
function avatar(dati, id) {
  if (!id) return '<span class="av av-libera" aria-hidden="true"><svg class="ic"><use href="#i-casa"/></svg></span>';
  const n = Math.max(0, dati.coinquilini.findIndex(c => c.id === id)) % 5;
  const iniziale = [...nomeDi(dati, id).trim()][0]?.toUpperCase() ?? '?';
  return `<span class="av av-${n}" aria-hidden="true">${esc(iniziale)}</span>`;
}

function imposta(titolo, sottotitolo, html) {
  document.getElementById('titolo').textContent = titolo;
  document.getElementById('sottotitolo').textContent = sottotitolo;
  contenuto.innerHTML = html;
}

function etichettaGiorno(g) {
  const oggiStr = oggi();
  if (g === oggiStr) return `Oggi · ${dataBreve(g)}`;
  if (g === aggiungiGiorni(oggiStr, 1)) return `Domani · ${dataBreve(g)}`;
  return dataLunga(g);
}

// ---------- Viste ----------

function vistaOggi(dati) {
  const g = oggi();
  const voci = dati.attive.map(f => daFare(f, dati.completamenti, g)).filter(Boolean)
    .sort((a, b) => (a.ritardoDal ?? '9').localeCompare(b.ritardoDal ?? '9')
      || a.faccenda.titolo.localeCompare(b.faccenda.titolo));
  const fatteOggi = dati.completamenti
    .filter(c => dataLocale(new Date(c.fattaIl)) === g)
    .sort((a, b) => b.fattaIl.localeCompare(a.fattaIl));

  const daFareHtml = voci.length
    ? `<ul class="lista">${voci.map(v => `
        <li class="card ${v.ritardoDal ? 'ritardo' : ''}">
          ${avatar(dati, v.faccenda.assegnataA)}
          <div class="info">
            <strong>${esc(v.faccenda.titolo)}</strong>
            <span class="meta">${chi(dati, v.faccenda)}</span>
            ${v.ritardoDal ? `<span class="badge">In ritardo dal ${dataBreve(v.ritardoDal)}</span>` : ''}
          </div>
          <button class="btn" data-fatta="${v.faccenda.id}" data-data="${v.dataPrevista}" data-ritardo="${v.ritardoDal ?? ''}">Fatta</button>
        </li>`).join('')}</ul>`
    : '<p class="vuoto">Niente da fare. Casa in ordine!</p>';

  const fatteHtml = fatteOggi.length
    ? `<h2>Fatte oggi</h2><ul class="lista">${fatteOggi.map(c => `
        <li class="card fatta">
          ${avatar(dati, c.fattaDa)}
          <div class="info">
            <strong>${esc(titoloDi(dati, c.faccendaId))}</strong>
            <span class="esito">Fatta da ${esc(nomeDi(dati, c.fattaDa))} · ${dataOra(c.fattaIl)}</span>
          </div>
          <button class="btn secondario piccolo" data-annulla="${c.id}">Annulla</button>
        </li>`).join('')}</ul>`
    : '';

  imposta('Oggi', dataLunga(g), `<h2>Da fare</h2>${daFareHtml}${fatteHtml}`);
}

function vistaCalendario(dati) {
  const inizio = oggi();
  let html = '';
  for (let i = 0; i < GIORNI_CALENDARIO; i++) {
    const g = aggiungiGiorni(inizio, i);
    const delGiorno = dati.attive.filter(f => cadeIl(f, g) && g >= f.inizio)
      .sort((a, b) => a.titolo.localeCompare(b.titolo));
    const voci = delGiorno.map(f => {
      const c = dati.completamenti.find(x => x.faccendaId === f.id && x.dataPrevista === g);
      return `
        <li class="card ${c ? 'fatta' : ''}">
          ${avatar(dati, c ? c.fattaDa : f.assegnataA)}
          <div class="info">
            <strong>${esc(f.titolo)}</strong>
            ${c ? `<span class="esito">Fatta da ${esc(nomeDi(dati, c.fattaDa))} · ${dataOra(c.fattaIl)}</span>`
                : `<span class="meta">${chi(dati, f)}</span>`}
          </div>
          ${c ? '' : `<button class="btn secondario piccolo" data-fatta="${f.id}" data-data="${g}" data-ritardo="">Fatta</button>`}
        </li>`;
    }).join('');
    html += `
      <section class="giorno-cal ${i === 0 ? 'oggi' : ''}" data-giorno="${g}">
        <h2>${etichettaGiorno(g)}</h2>
        ${voci ? `<ul class="lista">${voci}</ul>` : '<p class="vuoto">Niente in programma</p>'}
      </section>`;
  }
  imposta('Calendario', `Prossime ${GIORNI_CALENDARIO / 7} settimane`, html);
}

function vistaCoinquilini(dati) {
  const g = oggi();
  const righe = dati.persone.map(p => {
    const assegnate = dati.attive.filter(f => f.assegnataA === p.id).length;
    const fatte = dati.completamenti.filter(c => c.fattaDa === p.id).length;
    return `
      <li><a class="card" href="#persona/${p.id}">
        ${avatar(dati, p.id)}
        <div class="info">
          <strong>${esc(p.nome)}</strong>
          <span class="meta">${assegnate} assegnate · ${fatte} fatte</span>
        </div><span class="freccia" aria-hidden="true">›</span>
      </a></li>`;
  }).join('');
  imposta('Coinquilini', dataLunga(g),
    righe ? `<ul class="lista">${righe}</ul>` : '<p class="vuoto">Nessun coinquilino. Aggiungili da Gestione.</p>');
}

function vistaPersona(dati, id) {
  const p = dati.coinquilini.find(c => c.id === id);
  if (!p) return vistaCoinquilini(dati);
  const g = oggi();

  const assegnate = dati.attive.filter(f => f.assegnataA === id)
    .sort((a, b) => a.titolo.localeCompare(b.titolo))
    .map(f => {
      const stato = daFare(f, dati.completamenti, g);
      const prossima = prossimaData(f, g);
      let nota = prossima ? `Prossima: ${etichettaGiorno(prossima)}` : 'Nessuna data in programma';
      if (stato?.ritardoDal) nota = `<span class="badge">In ritardo dal ${dataBreve(stato.ritardoDal)}</span>`;
      return `
        <li class="card ${stato?.ritardoDal ? 'ritardo' : ''}">
          <div class="info">
            <strong>${esc(f.titolo)}</strong>
            <span class="meta">${descriviProgrammazione(f.programmazione)}</span>
            <span class="meta">${nota}</span>
          </div>
          ${stato ? `<button class="btn piccolo" data-fatta="${f.id}" data-data="${stato.dataPrevista}" data-ritardo="${stato.ritardoDal ?? ''}">Fatta</button>` : ''}
        </li>`;
    }).join('');

  const storico = dati.completamenti.filter(c => c.fattaDa === id)
    .sort((a, b) => b.fattaIl.localeCompare(a.fattaIl))
    .map(c => `
      <li class="card">
        <div class="info">
          <strong>${esc(titoloDi(dati, c.faccendaId))}</strong>
          <span class="esito">✓ ${dataOra(c.fattaIl)}</span>
          ${c.ritardoDal ? `<span class="meta">Era in ritardo dal ${dataBreve(c.ritardoDal)}</span>` : ''}
        </div>
      </li>`).join('');

  imposta(p.nome, p.archiviato ? 'Non più in casa' : 'Le sue faccende', `
    <h2>Assegnate a ${esc(p.nome)}</h2>
    ${assegnate ? `<ul class="lista" id="assegnate">${assegnate}</ul>` : '<p class="vuoto">Nessuna faccenda assegnata.</p>'}
    <h2>Fatte da ${esc(p.nome)}</h2>
    ${storico ? `<ul class="lista" id="storico">${storico}</ul>` : '<p class="vuoto">Ancora niente.</p>'}`);
}

function vistaGestione(dati) {
  const faccende = [...dati.attive].sort((a, b) => a.titolo.localeCompare(b.titolo)).map(f => `
    <li><a class="card" href="#faccenda/${f.id}">
      ${avatar(dati, f.assegnataA)}
      <div class="info">
        <strong>${esc(f.titolo)}</strong>
        <span class="meta">${descriviProgrammazione(f.programmazione)}</span>
        <span class="meta">${chi(dati, f)}</span>
      </div><span class="freccia" aria-hidden="true">›</span>
    </a></li>`).join('');

  const persone = dati.persone.map(p => `
    <li class="card riga-nome">
      ${avatar(dati, p.id)}
      <input type="text" value="${esc(p.nome)}" data-rinomina="${p.id}" aria-label="Nome di ${esc(p.nome)}">
      <button class="btn pericolo piccolo" data-rimuovi="${p.id}">Rimuovi</button>
    </li>`).join('');

  imposta('Gestione', 'Faccende e coinquilini', `
    <a class="btn largo" href="#faccenda/nuova">+ Nuova faccenda</a>
    <h2>Faccende</h2>
    <ul class="lista">${faccende}</ul>
    <h2>Coinquilini</h2>
    <ul class="lista">${persone}</ul>
    <form id="nuovo-coinquilino" class="riga-nome aggiungi">
      <input type="text" name="nome" placeholder="Nome del nuovo coinquilino" required>
      <button class="btn">Aggiungi</button>
    </form>`);
}

function vistaModulo(dati, id) {
  const f = dati.faccende.find(x => x.id === id);
  const nuova = !f;
  const p = f?.programmazione ?? { tipo: 'settimanale', giorni: [] };
  const domani = aggiungiGiorni(dataLocale(), 1);

  imposta(nuova ? 'Nuova faccenda' : 'Modifica faccenda', nuova ? 'Cosa, quando e chi' : f.titolo, `
    <form id="modulo-faccenda" class="modulo" data-id="${nuova ? '' : f.id}">
      <label class="campo">Cosa c'è da fare
        <input type="text" name="titolo" required value="${esc(f?.titolo ?? '')}" placeholder="Es. Annaffiare le piante">
      </label>
      <label class="campo">Chi la fa
        <select name="assegnataA">
          <option value="">Libera, chiunque</option>
          ${dati.persone.map(c => `<option value="${c.id}" ${f?.assegnataA === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select>
      </label>
      <fieldset>
        <legend>Quando</legend>
        <div class="scelte">
          <label><input type="radio" name="tipo" value="settimanale" ${p.tipo === 'settimanale' ? 'checked' : ''}>Giorni fissi</label>
          <label><input type="radio" name="tipo" value="una_volta" ${p.tipo === 'una_volta' ? 'checked' : ''}>Una volta sola</label>
        </div>
        <div class="scelte" id="scelta-giorni" ${p.tipo === 'settimanale' ? '' : 'hidden'}>
          ${ORDINE_SETTIMANA.map(g => `<label><input type="checkbox" name="giorni" value="${g}" ${p.giorni?.includes(g) ? 'checked' : ''}>${GIORNI_BREVI[g]}</label>`).join('')}
        </div>
        <div id="scelta-data" ${p.tipo === 'una_volta' ? '' : 'hidden'}>
          <input type="date" name="data" min="${dataLocale()}" value="${p.data ?? domani}" aria-label="Data">
        </div>
      </fieldset>
      <p class="errore" id="errore" hidden></p>
      <div class="azioni">
        <button class="btn">Salva</button>
        <a class="btn secondario" href="#gestione">Annulla</a>
        ${nuova ? '' : `<button type="button" class="btn pericolo" data-elimina-faccenda="${f.id}">Elimina</button>`}
      </div>
    </form>`);
}

// ---------- Azioni ----------

function scegliNome(dati, titolo, preferito) {
  return new Promise(risolvi => {
    dialogo.innerHTML = `
      <h3>Chi l'ha fatta?</h3>
      <p>${esc(titolo)}</p>
      <div class="nomi">${dati.persone.map(c => `
        <button class="btn ${c.id === preferito ? '' : 'secondario'}" value="${c.id}">${esc(c.nome)}</button>`).join('')}
      </div>
      <button class="btn nudo largo" value="">Annulla</button>`;
    dialogo.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      dialogo.close();
      risolvi(b.value || null);
    };
    dialogo.onclose = () => risolvi(null);
    dialogo.showModal();
  });
}

// I pulsanti distruttivi chiedono un secondo tocco invece di un popup.
function confermato(bottone) {
  if (bottone.dataset.armato) return true;
  bottone.dataset.armato = '1';
  bottone.textContent = 'Tocca ancora per confermare';
  return false;
}

contenuto.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const dati = await carica();

  if (b.dataset.fatta) {
    const f = dati.faccende.find(x => x.id === b.dataset.fatta);
    const persona = await scegliNome(dati, f.titolo, f.assegnataA);
    if (!persona) return;
    await db.inserisci('completamenti', {
      faccendaId: f.id,
      dataPrevista: b.dataset.data,
      ritardoDal: b.dataset.ritardo || null,
      fattaDa: persona,
      fattaIl: new Date().toISOString(),
    });
  } else if (b.dataset.annulla) {
    await db.elimina('completamenti', b.dataset.annulla);
  } else if (b.dataset.rimuovi) {
    if (!confermato(b)) return;
    await db.aggiorna('coinquilini', b.dataset.rimuovi, { archiviato: true });
    for (const f of dati.faccende.filter(x => x.assegnataA === b.dataset.rimuovi)) {
      await db.aggiorna('faccende', f.id, { assegnataA: null });
    }
  } else if (b.dataset.eliminaFaccenda) {
    if (!confermato(b)) return;
    await db.aggiorna('faccende', b.dataset.eliminaFaccenda, { archiviata: true });
    location.hash = '#gestione';
    return;
  } else {
    return;
  }
  mostra();
});

contenuto.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.rinomina && t.value.trim()) {
    await db.aggiorna('coinquilini', t.dataset.rinomina, { nome: t.value.trim() });
  }
  if (t.name === 'tipo') {
    document.getElementById('scelta-giorni').hidden = t.value !== 'settimanale';
    document.getElementById('scelta-data').hidden = t.value !== 'una_volta';
  }
});

contenuto.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const v = new FormData(form);

  if (form.id === 'nuovo-coinquilino') {
    await db.inserisci('coinquilini', { nome: v.get('nome').trim(), archiviato: false });
    return mostra();
  }

  if (form.id === 'modulo-faccenda') {
    const errore = document.getElementById('errore');
    const tipo = v.get('tipo');
    const programmazione = tipo === 'settimanale'
      ? { tipo, giorni: v.getAll('giorni').map(Number) }
      : { tipo, data: v.get('data') };
    if (tipo === 'settimanale' && !programmazione.giorni.length) {
      errore.textContent = 'Scegli almeno un giorno.';
      errore.hidden = false;
      return;
    }
    if (tipo === 'una_volta' && !programmazione.data) {
      errore.textContent = 'Scegli la data.';
      errore.hidden = false;
      return;
    }
    const campi = { titolo: v.get('titolo').trim(), assegnataA: v.get('assegnataA') || null, programmazione };
    const id = form.dataset.id;
    if (id) {
      const vecchia = (await db.elenco('faccende')).find(f => f.id === id);
      // Se cambiano i giorni, il ritardo riparte da oggi.
      if (JSON.stringify(vecchia.programmazione) !== JSON.stringify(programmazione)) campi.inizio = dataLocale();
      await db.aggiorna('faccende', id, campi);
    } else {
      await db.inserisci('faccende', { ...campi, inizio: dataLocale(), creataIl: new Date().toISOString(), archiviata: false });
    }
    location.hash = '#gestione';
  }
});

// ---------- Avvio ----------

async function mostra() {
  const [rotta, param] = (location.hash.slice(1) || 'oggi').split('/');
  const dati = await carica();
  const tab = { persona: 'coinquilini', faccenda: 'gestione' }[rotta] ?? rotta;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('attivo', a.dataset.tab === tab));
  const viste = {
    oggi: vistaOggi, calendario: vistaCalendario, coinquilini: vistaCoinquilini,
    persona: vistaPersona, gestione: vistaGestione, faccenda: vistaModulo,
  };
  (viste[rotta] ?? vistaOggi)(dati, param);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', mostra);
await db.inizializzaSeVuoto(datiIniziali());
mostra();
