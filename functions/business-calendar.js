const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

const datePartsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const shortDisplayFmt = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  dateStyle: 'short',
  timeStyle: 'short'
});

const timeFmt = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Returns normalized date and clock fields in America/Lima (UTC-5 year-round).
 */
export function limaClock(date = new Date()) {
  const parts = Object.fromEntries(datePartsFmt.formatToParts(date).map(p => [p.type, p.value]));
  const businessDate = `${parts.year}-${parts.month}-${parts.day}`;
  const weekdayIndex = new Date(`${businessDate}T12:00:00Z`).getUTCDay();
  return {
    businessDate,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekdayIndex,
    weekdayName: WEEKDAYS_ES[weekdayIndex],
    isSunday: weekdayIndex === 0,
    timeLabel: timeFmt.format(date),
    dateTimeLabel: shortDisplayFmt.format(date),
    iso: date.toISOString()
  };
}

/**
 * Returns whether a YYYY-MM-DD date string falls on Sunday in Lima calendar.
 */
export function isSundayDate(businessDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate || '')) return false;
  return new Date(`${businessDate}T12:00:00Z`).getUTCDay() === 0;
}

/**
 * Computes exact UTC ISO instant of 00:00:00 America/Lima following businessDate.
 */
export function limaMidnightAfterIso(businessDate) {
  const utcDayStart = Date.parse(`${businessDate}T00:00:00Z`);
  return new Date(utcDayStart + 24 * 60 * 60 * 1000 + LIMA_OFFSET_MS).toISOString();
}

/**
 * Formats DD/MM/YY or DD/MM/YYYY date labels from legacy orders/kardex into YYYY-MM-DD.
 */
export function parseLegacyDateToLima(rawDate, fallbackDate) {
  if (typeof rawDate === 'string') {
    const isoMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    const peMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (peMatch) {
      const dd = peMatch[1].padStart(2, '0');
      const mm = peMatch[2].padStart(2, '0');
      const yyyy = peMatch[3].length === 2 ? `20${peMatch[3]}` : peMatch[3];
      const candidate = `${yyyy}-${mm}-${dd}`;
      if (!Number.isNaN(Date.parse(`${candidate}T12:00:00Z`))) return candidate;
    }
  }
  return fallbackDate;
}

/**
 * Computes inclusive Lima businessDate boundaries for day, week, month, or year reports.
 */
export function reportDateRange(period, anchorDate) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(anchorDate || '') ? anchorDate : limaClock().businessDate;
  const anchor = new Date(`${valid}T12:00:00Z`);
  const fmt = d => d.toISOString().slice(0, 10);

  if (period === 'week') {
    const day = anchor.getUTCDay();
    const diffToMon = (day + 6) % 7;
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() - diffToMon);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { period: 'week', startDate: fmt(start), endDate: fmt(end) };
  }
  if (period === 'month') {
    const ym = valid.slice(0, 7);
    const lastDay = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
    return { period: 'month', startDate: `${ym}-01`, endDate: `${ym}-${String(lastDay).padStart(2, '0')}` };
  }
  if (period === 'year') {
    const yyyy = valid.slice(0, 4);
    return { period: 'year', startDate: `${yyyy}-01-01`, endDate: `${yyyy}-12-31` };
  }
  return { period: 'day', startDate: valid, endDate: valid };
}
