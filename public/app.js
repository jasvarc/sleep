const SVG_NS = 'http://www.w3.org/2000/svg';
const WEEKDAY_SHORT = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.appendChild(c);
  return node;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// axis hodnota (hodiny od poludnia noci) -> "HH:MM" skutocneho casu
function clockLabel(v) {
  const totalMin = Math.round(720 + v * 60);
  const dayMin = ((totalMin % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(dayMin / 60))}:${pad2(dayMin % 60)}`;
}

function dateLabel(d) {
  return `${pad2(d.day)}.${pad2(d.month)}.`;
}

function weekdayShort(d) {
  const wd = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
  return WEEKDAY_SHORT[wd];
}

function durationLabel(hours) {
  const totalMin = Math.round(hours * 60);
  return `${Math.floor(totalMin / 60)}h ${pad2(totalMin % 60)}m`;
}

function gridStep(range) {
  if (range <= 12) return 1;
  if (range <= 20) return 2;
  if (range <= 28) return 3;
  return 4;
}

const tooltip = document.getElementById('tooltip');

function showTooltip(evt, night) {
  const lines = [];
  lines.push(`<div class="tt-date">${weekdayShort(night.date)} ${dateLabel(night.date)}${night.date.year}</div>`);
  if (night.segments.length === 0) {
    lines.push('<div>Žiadne dáta</div>');
  } else {
    for (const seg of night.segments) {
      lines.push(`<div>${clockLabel(seg.start)} – ${clockLabel(seg.end)} (${durationLabel(seg.end - seg.start)})</div>`);
    }
  }
  if (night.estimated && !night.noData) {
    lines.push(`<div class="tt-est">Odhad – priemer z ${night.refCount} okolitých nocí</div>`);
  } else if (night.noData) {
    lines.push('<div class="tt-est">Bez dát v okolí</div>');
  }
  tooltip.innerHTML = lines.join('');
  tooltip.hidden = false;
  moveTooltip(evt);
}

function moveTooltip(evt) {
  const x = evt.clientX + 14;
  const y = evt.clientY + 14;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function renderChart(mountId, chartData, columnWidth) {
  const mount = document.getElementById(mountId);
  mount.innerHTML = '';

  const { nights, yMin, yMax } = chartData;
  const margin = { top: 10, right: 16, bottom: 26, left: 46 };
  const plotHeight = 340;
  const plotWidth = columnWidth * nights.length;
  const width = margin.left + plotWidth + margin.right;
  const height = margin.top + plotHeight + margin.bottom;

  const range = yMax - yMin;
  const yScale = (v) => margin.top + ((v - yMin) / range) * plotHeight;

  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}` });

  // gridlines + osove popisky (hodiny)
  const step = gridStep(range);
  const gridGroup = el('g');
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    const y = yScale(v);
    gridGroup.appendChild(
      el('line', { class: 'gridline', x1: margin.left, x2: margin.left + plotWidth, y1: y, y2: y })
    );
    const label = el('text', { class: 'axis-label', x: margin.left - 8, y: y + 3, 'text-anchor': 'end' });
    label.textContent = clockLabel(v);
    gridGroup.appendChild(label);
  }
  svg.appendChild(gridGroup);
  svg.appendChild(
    el('line', {
      class: 'baseline',
      x1: margin.left,
      x2: margin.left,
      y1: margin.top,
      y2: margin.top + plotHeight,
    })
  );

  // hatch pattern pre odhadovane noci
  const defs = el('defs');
  const pattern = el('pattern', {
    id: `hatch-${mountId}`,
    width: 5,
    height: 5,
    patternTransform: 'rotate(45)',
    patternUnits: 'userSpaceOnUse',
  });
  pattern.appendChild(
    el('line', { x1: 0, y1: 0, x2: 0, y2: 5, class: 'estimated-hatch' })
  );
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const gap = Math.max(1, Math.min(6, columnWidth * 0.18));
  const barWidth = Math.max(1, columnWidth - gap);
  const rx = Math.min(4, barWidth / 2);
  const labelEvery = Math.max(1, Math.ceil(nights.length / 14));

  nights.forEach((night, i) => {
    const x = margin.left + i * columnWidth + gap / 2;

    // neviditelny hit-rect pre hover cez cely stlpec
    const hit = el('rect', {
      x,
      y: margin.top,
      width: barWidth,
      height: plotHeight,
      fill: 'transparent',
    });
    hit.addEventListener('mouseenter', (evt) => showTooltip(evt, night));
    hit.addEventListener('mousemove', moveTooltip);
    hit.addEventListener('mouseleave', hideTooltip);
    svg.appendChild(hit);

    for (const seg of night.segments) {
      const y1 = yScale(seg.start);
      const y2 = yScale(seg.end);
      const h = Math.max(1, y2 - y1);
      const rect = el('rect', {
        x,
        y: y1,
        width: barWidth,
        height: h,
        rx,
        ry: rx,
        class: `sleep-block ${night.estimated ? 'estimated-fill' : 'real'}`,
      });
      rect.style.pointerEvents = 'none';
      svg.appendChild(rect);

      if (night.estimated) {
        const hatchRect = el('rect', {
          x,
          y: y1,
          width: barWidth,
          height: h,
          rx,
          ry: rx,
          fill: `url(#hatch-${mountId})`,
        });
        hatchRect.style.pointerEvents = 'none';
        svg.appendChild(hatchRect);
      }
    }

    if (i % labelEvery === 0 || i === nights.length - 1) {
      const dl = el('text', {
        class: 'axis-date-label',
        x: x + barWidth / 2,
        y: margin.top + plotHeight + 16,
        'text-anchor': 'middle',
      });
      dl.textContent = dateLabel(night.date);
      svg.appendChild(dl);
    }
  });

  mount.appendChild(svg);
}

function renderTable(targetId, nights) {
  const wrap = document.getElementById(targetId);
  wrap.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Dátum</th>
        <th>Úseky spánku</th>
        <th>Trvanie spolu</th>
        <th>Poznámka</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  for (const night of nights) {
    const tr = document.createElement('tr');
    const totalHours = night.segments.reduce((a, s) => a + (s.end - s.start), 0);
    const segmentsText = night.segments.length
      ? night.segments.map((s) => `${clockLabel(s.start)}–${clockLabel(s.end)}`).join(', ')
      : '—';
    const note = night.noData
      ? 'bez dát v okolí'
      : night.estimated
        ? `odhad (${night.refCount} okolitých nocí)`
        : '';
    tr.innerHTML = `
      <td>${weekdayShort(night.date)} ${dateLabel(night.date)}${night.date.year}</td>
      <td>${segmentsText}</td>
      <td>${night.segments.length ? durationLabel(totalHours) : '—'}</td>
      <td class="${note ? 'estimated-tag' : ''}">${note}</td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
}

document.querySelectorAll('.table-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const willShow = target.hidden;
    target.hidden = !willShow;
    btn.textContent = willShow ? 'Skryť tabuľku' : 'Zobraziť ako tabuľku';
  });
});

async function init() {
  const subtitle = document.getElementById('subtitle');
  const errorBox = document.getElementById('error');
  try {
    const res = await fetch('/api/sleep-data');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    subtitle.textContent = `Dáta z kalendára „Sleep as Android“ · posledná zaznamenaná noc: ${data.latestNight}`;

    renderChart('chart-week', data.week, 88);
    renderChart('chart-month', data.month, 30);
    renderChart('chart-quarter', data.quarter, 9);

    renderTable('table-week', data.week.nights);
    renderTable('table-month', data.month.nights);
    renderTable('table-quarter', data.quarter.nights);
  } catch (err) {
    console.error(err);
    subtitle.textContent = '';
    errorBox.hidden = false;
    errorBox.textContent = `Chyba pri načítaní dát: ${err.message}`;
  }
}

init();
