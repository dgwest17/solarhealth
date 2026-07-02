/**
 * Green Button interval-data parser.
 *
 * Currently supports the SDG&E "CSV Export Electric Meter(s)" format:
 *   ~13 metadata lines (Name, Address, Meter, Reading Start/End, ...)
 *   header row:  Meter Number,Date,Start Time,Duration,Consumption,Generation,Net
 *   ~35k quoted 15-minute interval rows.
 *
 * IMPORTANT COLUMN SEMANTICS (verified against a real SDG&E NEM export):
 *   Consumption = energy DELIVERED FROM THE GRID (imports) — NOT total house load.
 *   Generation  = energy EXPORTED TO THE GRID.
 *   Net         = Consumption − Generation (what SDG&E bills as "Total Usage").
 * The midday collapse of Consumption (solar covering the house) is the tell.
 *
 * Total house consumption therefore = annualProduction − exports + imports,
 * which requires knowing production from the system (Zoho / inverter).
 *
 * Other utilities use different formats; parseGreenButton dispatches on what
 * it detects and returns { ok:false, error } for unknown layouts so the UI can
 * say so instead of mis-parsing.
 */

// Per-utility TOU windows (hour-of-day, [start,end) in 24h) used to bucket
// measured imports. Kept simple; refine per rate schedule as needed.
const TOU_WINDOWS = {
  SDGE: { peak: [16, 21], superOffPeak: [0, 6] },
  SCE: { peak: [16, 21], superOffPeak: [8, 16] },
  PGE: { peak: [16, 21], superOffPeak: [0, 7] },
  SMUD: { peak: [17, 20], superOffPeak: [0, 6] }
};

function parseTime12h(t) {
  // "12:15 AM" -> hour 0..23 (bucket by starting hour)
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h;
}

// Minimal CSV line splitter that handles the quoted SDG&E rows.
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseGreenButton(text, utility = 'SDGE') {
  // ---- Specific failure diagnostics, so the user knows WHY it didn't read ----
  if (!text || !text.trim()) {
    return { ok: false, error: 'The file is empty. Re-download the export from your utility and try again.' };
  }
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) {
    return {
      ok: false,
      error: 'This looks like the Green Button XML format. SDG&E offers both — please download the CSV version ("Export as CSV" / "Electric 15 Minute" file) instead of the XML.'
    };
  }
  if (trimmed.startsWith('%PDF')) {
    return { ok: false, error: 'This is a PDF (probably a bill), not interval data. Download the Green Button CSV export from the usage section of your utility account.' };
  }

  const lines = text.split(/\r?\n/);

  // Locate the interval header row; metadata line count varies by account.
  let headerIdx = -1;
  let cols = null;
  let sawPartialHeader = null;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const parts = splitCsvLine(lines[i]);
    const hasDate = parts.includes('Date');
    const hasTime = parts.includes('Start Time');
    const hasCons = parts.includes('Consumption');
    if (parts.length >= 5 && hasDate && hasTime && hasCons) {
      headerIdx = i;
      cols = parts;
      break;
    }
    if ((hasDate || hasTime || hasCons) && parts.length >= 3) {
      sawPartialHeader = parts;
    }
  }
  if (headerIdx < 0) {
    if (sawPartialHeader) {
      const missing = ['Date', 'Start Time', 'Consumption'].filter((c) => !sawPartialHeader.includes(c));
      return {
        ok: false,
        error: `Found a data header but it's missing the ${missing.join(' and ')} column${missing.length > 1 ? 's' : ''}. This may be a different utility's format (only SDG&E's 15-minute CSV is supported so far) or a summary export instead of interval data.`
      };
    }
    return {
      ok: false,
      error: 'No interval-data header found (looked for Date / Start Time / Consumption columns in the first 60 lines). This doesn\u2019t appear to be an SDG&E Green Button 15-minute CSV — other utilities\u2019 formats aren\u2019t supported yet. If this is from SDG&E, make sure it\u2019s the "Electric 15 Minute" CSV export.'
    };
  }

  const ix = {
    date: cols.indexOf('Date'),
    time: cols.indexOf('Start Time'),
    cons: cols.indexOf('Consumption'),
    gen: cols.indexOf('Generation'),
    net: cols.indexOf('Net')
  };

  // Metadata (best-effort, display only)
  const meta = {};
  for (let i = 0; i < headerIdx; i++) {
    const p = splitCsvLine(lines[i]);
    if (p.length >= 2 && p[0]) meta[p[0]] = p.slice(1).join(',');
  }

  const days = new Set();
  let importKwh = 0;
  let exportKwh = 0;
  const hourlyImport = new Array(24).fill(0);
  const hourlyExport = new Array(24).fill(0);
  let rows = 0;
  let skippedTime = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const p = splitCsvLine(lines[i]);
    if (p.length < 5) continue;
    const h = parseTime12h(p[ix.time]);
    if (h == null) { skippedTime++; continue; }
    const c = parseFloat(p[ix.cons]) || 0;
    const g = ix.gen >= 0 ? (parseFloat(p[ix.gen]) || 0) : 0;
    importKwh += c;
    exportKwh += g;
    hourlyImport[h] += c;
    hourlyExport[h] += g;
    days.add(p[ix.date]);
    rows++;
  }

  if (rows === 0) {
    if (skippedTime > 0) {
      return { ok: false, error: `Found ${skippedTime.toLocaleString()} data rows but couldn't read their Start Time values (expected e.g. "12:15 AM"). The time format may differ from SDG&E's — send this file over so the format can be added.` };
    }
    return { ok: false, error: 'The header was recognized but no data rows followed it. The export may have been cut off — try re-downloading it.' };
  }

  const dayCount = Math.max(1, days.size);
  const scale = 365 / dayCount; // annualize partial ranges

  const win = TOU_WINDOWS[utility] || TOU_WINDOWS.SDGE;
  const inWin = (h, [a, b]) => h >= a && h < b;
  let peakImport = 0;
  let sopImport = 0;
  for (let h = 0; h < 24; h++) {
    if (inWin(h, win.peak)) peakImport += hourlyImport[h];
    else if (inWin(h, win.superOffPeak)) sopImport += hourlyImport[h];
  }
  const offImport = importKwh - peakImport - sopImport;

  const hasGeneration = exportKwh > 1; // some accounts have no solar channel

  // Coverage warning: annualizing a partial year is mathematically fine but
  // seasonally skewed (a winter-only file understates A/C load and exports).
  let warning = null;
  if (dayCount < 300) {
    warning = `Only ${dayCount} days of data — annualized figures are scaled up (×${scale.toFixed(2)}) and may be skewed by season. A full 12-month export gives the most accurate picture.`;
  } else if (skippedTime > 0) {
    warning = `${skippedTime.toLocaleString()} rows had unreadable times and were skipped.`;
  }

  return {
    ok: true,
    warning,
    meta: {
      name: meta['Name'] || '',
      address: meta['Address'] || '',
      meter: meta['Meter Number'] || '',
      readingStart: meta['Reading Start'] || '',
      readingEnd: meta['Reading End'] || ''
    },
    days: dayCount,
    rows,
    // Raw measured totals over the file's range:
    importKwh: Math.round(importKwh),
    exportKwh: Math.round(exportKwh),
    netKwh: Math.round(importKwh - exportKwh),
    hasGeneration,
    // Annualized (scaled to 365 days):
    annualImportKwh: Math.round(importKwh * scale),
    annualExportKwh: Math.round(exportKwh * scale),
    annualNetKwh: Math.round((importKwh - exportKwh) * scale),
    // Hourly import/export profile in kWh over the range (24 buckets):
    hourlyImport: hourlyImport.map((v) => Math.round(v * 10) / 10),
    hourlyExport: hourlyExport.map((v) => Math.round(v * 10) / 10),
    // TOU split of imports (share of grid purchases in each window):
    touImportShare: {
      peak: importKwh ? peakImport / importKwh : 0,
      offPeak: importKwh ? offImport / importKwh : 0,
      superOffPeak: importKwh ? sopImport / importKwh : 0
    }
  };
}

/**
 * Derive total house consumption from measured grid data + known production.
 *   houseLoad = production − exports + imports
 * Returns null when production is unknown (can't be derived from grid data alone).
 */
export function deriveAnnualUsage(profile, annualProduction) {
  if (!profile || !profile.ok) return null;
  const prod = Number(annualProduction) || 0;
  if (prod <= 0) return null;
  return Math.round(prod - profile.annualExportKwh + profile.annualImportKwh);
}
