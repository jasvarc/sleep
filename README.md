# sleep

Appka na `https://tvoj-server/sleep/` zobrazujúca grafy spánku z Google
Kalendára "Sleep as Android". Server-side pri každej návšteve stránky stiahne
aktuálny stav kalendára (cez jeho tajnú iCal adresu) a vykreslí 3 grafy:
posledných 7 dní, posledných 28 dní a posledné 3 mesiace.

Každý graf má os y (čas dňa) v rozsahu od 16:00 (resp. skoršieho času
zaspávania, ak sa v danom grafe vyskytol) do 11:00 nasledujúceho dňa (resp.
neskoršieho času prebudenia, ak sa vyskytol) - rozsah sa počíta samostatne pre
každý z 3 grafov podľa dát, ktoré sa v ňom zobrazujú. Pre každú noc sa
vykreslia súvislé plochy pokrývajúce zaznamenané úseky spánku (viac úsekov za
noc je bežné - krátke prebudenia/šlofíky sa tak zobrazia ako medzery).

Ak pre nejaký deň chýbajú dáta úplne, appka ich dopočíta ako priemer z
najbližších existujúcich dní pred a po (max. 3 z každej strany) - v grafe sú
takéto noci odlíšené šrafovaním/nižšou opacitou.

DONE:
- server-side spracovanie ICS feedu kalendára "Sleep as Android" (bez
  externých závislostí, vlastný minimálny ICS parser - `server/ics.js`)
- logika priraďovania udalostí k "noci" (deň sa mení o 12:00 napoludnie, nie
  o polnoci) a dopočet chýbajúcich nocí priemerom okolitých - `server/sleepData.js`
- endpoint `/api/sleep-data` vracajúci pripravené dáta pre všetky 3 grafy
  naraz (vrátane samostatne vypočítaného rozsahu osi y pre každý graf)
- frontend: 3 SVG grafy (7 dní / 28 dní / 3 mesiace) s hover tooltipom
  (presné časy, trvanie, či ide o odhad), legendou a prepínateľnou tabuľkovou
  verziou dát pre každý graf (prístupnosť)
- svetlý aj tmavý režim (`prefers-color-scheme`)
- deploy skripty (systemd služba na porte 3002 + Apache reverse proxy na
  `/sleep/`) podľa vzoru appiek rozpravky a text_piesne

TODO:
1. overiť skutočné nasadenie na serveri s reálnou tajnou ICS adresou (zatiaľ
   otestované len lokálne s dátami stiahnutými cez Google Kalendár konektor)
2. zvážiť cachovanie ICS feedu na pár minút, ak by sa appka pri opakovaných
   návštevách za krátky čas ukázala pomalá (Google ICS feed vie mať sám o
   sebe oneskorenie aktualizácie v ráde hodín, takže cache na strane appky by
   len znížila počet requestov, nie čerstvosť dát)
