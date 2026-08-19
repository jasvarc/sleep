const path = require('path');
const express = require('express');
const { parseIcs } = require('./ics');
const { buildAllCharts } = require('./sleepData');

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '127.0.0.1';
const ICAL_URL = process.env.ICAL_URL || '';

app.use(express.static(path.join(__dirname, '..', 'public')));

async function fetchIcsText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'sleep-chart-app/1.0' } });
  if (!res.ok) {
    throw new Error(`Kalendár odpovedal HTTP ${res.status}`);
  }
  return res.text();
}

app.get('/api/sleep-data', async (req, res) => {
  if (!ICAL_URL) {
    console.error('[sleep-data] ICAL_URL nie je nastavené v .env');
    res.status(500).json({ error: 'Appka nie je nakonfigurovaná (chýba ICAL_URL v .env).' });
    return;
  }
  try {
    const icsText = await fetchIcsText(ICAL_URL);
    const rawEvents = parseIcs(icsText);
    console.log(`[sleep-data] stiahnutých ${rawEvents.length} udalostí z ICS feedu`);
    const charts = buildAllCharts(rawEvents);
    res.json(charts);
  } catch (err) {
    console.error('[sleep-data] chyba pri spracovaní:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Nepodarilo sa načítať alebo spracovať dáta zo Sleep as Android.' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`sleep beží na http://${HOST}:${PORT} (iba lokálne, verejne je dostupná cez Apache reverse proxy)`);
});
