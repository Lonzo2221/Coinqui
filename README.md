# Coinqui

App web per organizzare le faccende tra coinquilini: chi fa una faccenda la segna col suo nome e resta lo storico di chi l'ha fatta e quando; mostra cosa c'è da fare oggi e cosa è in ritardo, e ha un calendario del mese, dove si vede anche cosa è stato fatto nei giorni passati.
Ha anche una lista della spesa comune: chi compra una cosa la spunta, e dal giorno dopo sparisce dalla lista.
È fatta in HTML, CSS e JavaScript, senza librerie esterne; per ora è un prototipo e i dati restano nel browser, su un solo dispositivo (localStorage).
Per provarla in locale serve Node.js: esegui `node server.js` e apri http://localhost:5173.
Le prove automatiche si lanciano con `node prove/esegui.js` (serve Edge o Chrome).
