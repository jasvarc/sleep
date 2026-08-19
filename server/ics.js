// Minimalny parser ICS (iCalendar) feedu - potrebujeme len DTSTART/DTEND z
// VEVENT blokov kalendara "Sleep as Android". Ziadna externa zavislost.

function unfold(text) {
  // RFC 5545: pokracovanie riadku zacina medzerou alebo tabulatorom
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function toPragueWallString(utcDate) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(utcDate).map((p) => [p.type, p.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`;
}

// Vrati "wall clock" ISO retazec (bez ohladu na offset - downstream logika cita
// priamo zapisane cislice) alebo null pre celodenne udalosti bez casu.
function parseIcsDateTimeProperty(line) {
  // napr.: DTSTART;TZID=Europe/Prague:20260805T011139
  //        DTSTART:20260804T231139Z
  //        DTSTART;VALUE=DATE:20260805
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  const params = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1).trim();

  if (/VALUE=DATE\b/.test(params) && !/VALUE=DATE-TIME/.test(params)) {
    return null; // celodenna udalost, nema zmysel pre spanok
  }

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;

  if (z === 'Z') {
    const utcDate = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
    return toPragueWallString(utcDate);
  }
  // TZID lokalny cas (predpoklada sa, ze zodpoveda casu telefonu/hodiniek pouzivatela)
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

// Vrati [{ s, e }] pre kazdy VEVENT s platnym DTSTART aj DTEND
function parseIcs(icsText) {
  const text = unfold(icsText);
  const lines = text.split('\n');
  const events = [];

  let inEvent = false;
  let dtstart = null;
  let dtend = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      dtstart = null;
      dtend = null;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inEvent && dtstart && dtend) {
        events.push({ s: dtstart, e: dtend });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith('DTSTART')) {
      dtstart = parseIcsDateTimeProperty(line);
    } else if (line.startsWith('DTEND')) {
      dtend = parseIcsDateTimeProperty(line);
    }
  }

  return events;
}

module.exports = { parseIcs, parseIcsDateTimeProperty, toPragueWallString };
