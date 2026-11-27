export const STATIONS = ['COCINA', 'BARRA'];

export function orderStations(order) {
  const stations = STATIONS.filter(station => order.items.some(item => item.station === station));
  return stations.length ? stations : ['COCINA'];
}

export function stationReady(order, station) {
  return order.status === 'LISTO_CHEF' || Boolean(order.stationCompletedAt?.[station]);
}

const limaTimeZone = 'America/Lima';
let completionFormat;
let dateFormat;

/**
 * Parses ISO timestamps as well as es-PE 24h ("DD/MM/YYYY HH:mm") and 12h ("DD/MM/YY, h:mm a. m. / p. m.") dates in America/Lima (-05:00).
 */
export function parseLimaDateTime(value) {
  if (!value) return NaN;
  const raw = String(value).trim();
  const pe = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2}))?(?:\s*([ap])\.?\s*m\.?)?$/i.exec(raw);
  if (!pe) return Date.parse(raw);
  const [, day, month, yearRaw, hourRaw = '0', minuteRaw = '0', meridiem] = pe;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  let hour = Number(hourRaw);
  if (meridiem) {
    const isPm = meridiem.toLowerCase() === 'p';
    if (isPm && hour < 12) hour += 12;
    else if (!isPm && hour === 12) hour = 0;
  }
  const pad = part => String(part).padStart(2, '0');
  return Date.parse(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minuteRaw)}:00-05:00`);
}

export function formatElapsedMinutesLabel(startMs, nowMs = Date.now()) {
  if (!Number.isFinite(startMs)) return '';
  const minutes = Math.max(0, Math.floor((nowMs - startMs) / 60000));
  if (minutes < 1) return '< 1 min';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours} h${remaining ? ` ${remaining} min` : ''}` : `${minutes} min`;
}

export function preparationStartedAt(order) {
  return parseLimaDateTime(order.preparationStartedAt || order.approvedAt);
}

function prepHistoryDate(time) {
  dateFormat ||= new Intl.DateTimeFormat('en-CA', {
    timeZone: limaTimeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const { year, month, day } = Object.fromEntries(dateFormat.formatToParts(time).map(({ type, value }) => [type, value]));
  return year + '-' + month + '-' + day;
}

export function formatPrepCompletion(time) {
  if (!Number.isFinite(time)) return 'Hora sin registro';
  completionFormat ||= new Intl.DateTimeFormat('es-PE', {
    timeZone: limaTimeZone, dateStyle: 'medium', timeStyle: 'short'
  });
  return completionFormat.format(time);
}

const normalizeSearch = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function prepHistory(orders, station, { search = '', date = '' } = {}) {
  const query = normalizeSearch(search);
  return orders
    .filter(order => (order.status === 'ENTREGADO' ||
      (['EN_COCINA', 'LISTO_CHEF'].includes(order.status) && stationReady(order, station))) &&
      orderStations(order).includes(station))
    .map(order => ({
      order, time: parseLimaDateTime(order.stationCompletedAt?.[station] || order.completedAt)
    }))
    .filter(({ order, time }) => (!query || [order.code, order.num, order.table].some(value =>
      normalizeSearch(value).includes(query))) && (!date || (Number.isFinite(time) && prepHistoryDate(time) === date)))
    .sort((a, b) => (Number.isFinite(b.time) ? b.time : -Infinity) - (Number.isFinite(a.time) ? a.time : -Infinity));
}
