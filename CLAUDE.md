# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Coinqui

## Cos'è
App per coinquilini che vivono insieme e si organizzano con le faccende
di casa e le altre cose da fare per vivere meglio. Serve a vedere cosa
c'è da fare, quando, e chi l'ha fatto.

## Regole dell'app
- Chiunque può segnare come fatta qualsiasi faccenda, scegliendo il suo nome.
- Le faccende si possono segnare come fatte anche in anticipo (scelta voluta).
- Si usa soprattutto da telefono: ogni schermata va pensata e provata
  prima a misura di telefono.
- Il ritardo si conta solo da quando la faccenda esiste. Più ritardi
  della stessa faccenda = una sola voce "in ritardo dal".
- Il calendario mostra un mese alla volta (con pallini fatto / non fatto /
  da fare); toccando un giorno si vede cosa c'era o c'è da fare. Sotto,
  i prossimi 7 giorni.
- Per ora niente login, account o notifiche.

## Lista della spesa
- Chiunque aggiunge una cosa (solo il nome) e la spunta quando la compra;
  la spunta si può togliere. Non si salva chi aggiunge né chi compra.
- Una cosa spuntata va nel blocco "Comprate oggi", barrata, per tutto quel
  giorno; dal giorno dopo non si vede più ma resta nei dati come archiviata.
  Conta l'ultima spunta.
- Se un nome è già nella lista (da comprare o comprato oggi) non si aggiunge:
  "Già presente". Toccando il nome di una cosa da comprare lo si corregge.
- In Gestione una faccenda si può collegare alla lista: in Oggi ha il tasto
  "Apri la lista". Segnarla fatta non cambia la lista.

## Regole tecniche
- Tutto il salvataggio passa da js/storage.js; nessun altro file usa
  localStorage. In futuro arriverà un database con un account per
  ogni coinquilino: storage.js è il punto che verrà sostituito.
- Niente librerie esterne senza chiedermelo.
- Per provarla: node server.js, poi http://localhost:5173
- ?oggi=AAAA-MM-GG nell'indirizzo finge un'altra data: serve solo per
  le prove. Va tolta prima di mettere l'app online.

## Come lavorare con me
- Prima di eseguire un comando, spiegami in breve cosa fa.
- Quando hai finito, riassumimi in poche righe cosa hai fatto.
- Quando una modifica funziona e l'ho provata, proponimi un commit.

## Note sul codice
- Non ci sono build né lint. Prove automatiche: node prove/esegui.js (serve
  Edge o Chrome; usa la porta 5174 e un profilo vuoto, quindi non tocca i
  dati di localhost:5173). Vanno rilanciate dopo ogni modifica.
- svuotaTutto() di storage.js serve solo alle prove: l'app non la usa.
- Per "oggi" usare sempre `oggi()` di js/logica.js, non `new Date()`,
  altrimenti `?oggi=` non funziona.
- Coinquilini e faccende non si cancellano, si archiviano: lo storico
  dei completamenti li richiama per nome.
- Non cambiare il prefisso `coinquilini.v1.` in storage.js: l'app
  perderebbe i dati già salvati.
