// Spracovanie surových udalostí z kalendára "Sleep as Android" do nočných blokov
// a zostavenie dát pre 3 grafy (7 dní / 28 dní / 3 mesiace).
//
// Kľúčová konvencia: "noc" patriaca dátumu D pokrýva obdobie od 12:00 dňa D do
// 12:00 dňa D+1. Udalosť patrí do noci D, ak jej začiatok padne pred 12:00 -> noc D-1
// (pokračovanie predchádzajúcej noci), inak noc D (večerný uspávací blok / dnešná noc).
//
// Os grafu ("axis") je vyjadrená v hodinách od poludnia noci D: 4 = 16:00 (16h),
// 12 = polnoc, 23 = 11:00 nasledujúceho dňa.

function parseWallTime(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) throw new Error(`Neplatný čas: ${iso}`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] ? Number(m[4]) : 0,
    minute: m[5] ? Number(m[5]) : 0,
  };
}

function dayNumber({ year, month, day }) {
  return Date.UTC(year, month - 1, day) / 86400000;
}

function addDays({ year, month, day }, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function dateKey({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nightDateOf(wt) {
  return wt.hour < 12 ? addDays(wt, -1) : { year: wt.year, month: wt.month, day: wt.day };
}

function axisValue(wt, nightDate) {
  const dayDiff = dayNumber(wt) - dayNumber(nightDate);
  return dayDiff * 24 + wt.hour + wt.minute / 60 - 12;
}

// rawEvents: [{ s: isoStart, e: isoEnd }] (lokálny čas s offsetom, offset sa ignoruje -
// berie sa priamo zapísaný "wall clock" čas, čo zodpovedá tomu, čo Sleep as Android
// zaznamenal ako lokálny čas telefónu/hodiniek).
function buildNights(rawEvents) {
  const nights = new Map();
  for (const { s, e } of rawEvents) {
    const wtStart = parseWallTime(s);
    const wtEnd = parseWallTime(e);
    const night = nightDateOf(wtStart);
    const key = dateKey(night);
    const axisStart = axisValue(wtStart, night);
    const axisEnd = axisValue(wtEnd, night);
    if (axisEnd <= axisStart) continue;
    if (!nights.has(key)) nights.set(key, { date: night, key, segments: [] });
    nights.get(key).segments.push({ start: axisStart, end: axisEnd });
  }
  for (const night of nights.values()) {
    night.segments.sort((a, b) => a.start - b.start);
    night.spanStart = Math.min(...night.segments.map((s) => s.start));
    night.spanEnd = Math.max(...night.segments.map((s) => s.end));
  }
  return nights;
}

function refsAround(presentSorted, presentNums, d) {
  const dn = dayNumber(d);
  const beforeIdx = [];
  const afterIdx = [];
  for (let i = 0; i < presentNums.length; i++) {
    if (presentNums[i] < dn) beforeIdx.push(i);
    else if (presentNums[i] > dn) afterIdx.push(i);
  }
  const before = beforeIdx.slice(-3).map((i) => presentSorted[i]);
  const after = afterIdx.slice(0, 3).map((i) => presentSorted[i]);
  return before.concat(after);
}

function buildChart(nightsMap, windowSize, latestNight) {
  const presentSorted = [...nightsMap.values()].sort((a, b) => dayNumber(a.date) - dayNumber(b.date));
  const presentNums = presentSorted.map((n) => dayNumber(n.date));

  const days = [];
  for (let i = windowSize - 1; i >= 0; i--) days.push(addDays(latestNight, -i));

  const chartNights = days.map((d) => {
    const key = dateKey(d);
    const existing = nightsMap.get(key);
    if (existing) {
      return {
        key,
        date: d,
        segments: existing.segments,
        spanStart: existing.spanStart,
        spanEnd: existing.spanEnd,
        estimated: false,
      };
    }
    const refs = refsAround(presentSorted, presentNums, d);
    if (refs.length === 0) {
      return { key, date: d, segments: [], spanStart: null, spanEnd: null, estimated: true, noData: true };
    }
    const avgStart = refs.reduce((a, r) => a + r.spanStart, 0) / refs.length;
    const avgEnd = refs.reduce((a, r) => a + r.spanEnd, 0) / refs.length;
    return {
      key,
      date: d,
      segments: [{ start: avgStart, end: avgEnd }],
      spanStart: avgStart,
      spanEnd: avgEnd,
      estimated: true,
      refCount: refs.length,
    };
  });

  let yMin = 4;
  let yMax = 23;
  for (const n of chartNights) {
    if (n.spanStart != null) yMin = Math.min(yMin, n.spanStart);
    if (n.spanEnd != null) yMax = Math.max(yMax, n.spanEnd);
  }
  yMin = Math.floor(yMin);
  yMax = Math.ceil(yMax);

  return { nights: chartNights, yMin, yMax };
}

function buildAllCharts(rawEvents) {
  const nightsMap = buildNights(rawEvents);
  if (nightsMap.size === 0) {
    throw new Error('Žiadne dáta o spánku na spracovanie.');
  }
  const latestNight = [...nightsMap.values()]
    .map((n) => n.date)
    .sort((a, b) => dayNumber(b) - dayNumber(a))[0];

  return {
    latestNight: dateKey(latestNight),
    week: buildChart(nightsMap, 7, latestNight),
    month: buildChart(nightsMap, 28, latestNight),
    quarter: buildChart(nightsMap, 90, latestNight),
  };
}

module.exports = {
  parseWallTime,
  dayNumber,
  addDays,
  dateKey,
  nightDateOf,
  axisValue,
  buildNights,
  buildChart,
  buildAllCharts,
};
