# Nasadenie na Ubuntu server (vedľa Home Assistanta / appiek rozpravky a text_piesne)

Appka beží ako samostatný Node.js proces, ktorý počúva **iba na
`127.0.0.1:3002`** (nie je dostupný zvonka). Verejne prístupná appka je iba
cez existujúci Apache na portoch 80/443, na ceste `https://tvoj-server/sleep/`,
vďaka reverse proxy. Do `/var/www/html/sleep` sa nekopírujú statické stránky
priamo servované Apache-om (Node.js sám servíruje svoj frontend), ale je to
praktické miesto na uloženie appky vedľa `rozpravky`, `text_piesne` a tvojich
existujúcich stránok.

Appka neukladá žiadne dáta na server (nič nepersistuje) - pri každej návšteve
stránky si server-side stiahne a spracuje aktuálny stav kalendára "Sleep as
Android" priamo z Google Kalendára. Žiadne pravidelné sťahovanie na pozadí.

## 1. Čo doinštalovať na Ubuntu (raz, pred prvým nasadením)

Ak si Node.js, git a Apache proxy moduly už nastavil (napr. pri appke
rozpravky alebo text_piesne), tento krok preskoč. Inak:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo apt-get install -y git

sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

Over si verzie:

```bash
node -v
npm -v
```

## 2. Naklonuj appku z gitu

Zdrojový kód appky je na `https://github.com/jasvarc/sleep`. `node_modules/`
nie je v repozitári, takže po klonovaní treba jednorazovo `npm install`:

```bash
cd /var/www/html
sudo git clone https://github.com/jasvarc/sleep.git sleep
cd sleep
sudo npm install --omit=dev
```

## 3. Zisti tajnú (secret) adresu kalendára "Sleep as Android"

V Google Kalendári (účet, pod ktorým beží kalendár "Sleep as Android"):

1. Nastavenia → v ľavom paneli klikni na kalendár **Sleep as Android**.
2. Sekcia **"Integrovať kalendár"**.
3. Skopíruj **"Tajná adresa vo formáte iCal"** ("Secret address in iCal
   format"). Vyzerá asi takto:
   `https://calendar.google.com/calendar/ical/xxxxx%40group.calendar.google.com/private-yyyyy/basic.ics`

Táto adresa je citlivý údaj (dá sa cez ňu čítať celý kalendár) - nezdieľaj ju
a nedávaj do gitu.

## 4. Spusti inštalačný skript

```bash
sudo bash deploy/install.sh
```

Skript:
- vytvorí `.env` z `.env.example` (ak ešte neexistuje),
- nastaví vlastníka súborov na `www-data`,
- zaregistruje a spustí systemd službu `sleep` (počúva iba na
  `127.0.0.1:3002`, automaticky sa naštartuje aj po reštarte servera).

## 5. Doplň tajnú adresu kalendára

```bash
sudo nano /var/www/html/sleep/.env
# doplň ICAL_URL=https://calendar.google.com/calendar/ical/...
sudo systemctl restart sleep
```

## 6. Nastav Apache reverse proxy

Otvor svoje existujúce Apache vhost súbory (typicky
`/etc/apache2/sites-enabled/000-default.conf` pre port 80 a príslušný
`*-le-ssl.conf` pre port 443) a do **každého** `<VirtualHost>` bloku, cez
ktorý má byť appka dostupná, pred `</VirtualHost>` vlož obsah z
`deploy/apache-sleep.conf`:

```apache
ProxyPass /sleep/ http://127.0.0.1:3002/
ProxyPassReverse /sleep/ http://127.0.0.1:3002/
```

Potom:

```bash
sudo apache2ctl configtest
sudo systemctl restart apache2
```

## 7. Over, že appka beží

```bash
sudo systemctl status sleep
```

Otvor v prehliadači `https://tvoj-server/sleep/`.

## Riešenie problémov

```bash
sudo journalctl -u sleep -f
```

Ak appka hlási "Appka nie je nakonfigurovaná (chýba ICAL_URL v .env)", chýba
alebo je prázdny `ICAL_URL` v `.env` (krok 5).

Ak appka hlási chybu pri sťahovaní kalendára, over, že si skopíroval presne
"Secret address in iCal format" (nie verejný/embed odkaz) a že kalendár
"Sleep as Android" v Google účte stále existuje pod rovnakým menom.

## Užitočné príkazy

```bash
# logy appky
sudo journalctl -u sleep -f

# reštart appky (napr. po zmene .env)
sudo systemctl restart sleep

# zastavenie appky
sudo systemctl stop sleep
```

## Aktualizácia appky v budúcnosti

```bash
cd /var/www/html/sleep
bash deploy/update.sh
```

Skript stiahne najnovšiu verziu (`git pull`), obnoví vlastníctvo súborov na
`www-data` a appku reštartuje. `.env` nie je v gite (je v `.gitignore`), takže
`git pull` sa ho nedotkne.

Ak appka pribudla node závislosť (zmenil sa `package.json`), treba po pulli
naviac spustiť `sudo npm install --omit=dev`.
