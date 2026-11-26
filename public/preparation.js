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

function parsePreparationTime(value) {
  const legacy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(value || '');
  if (!legacy) return Date.parse(value);
  const [, day, month, year, hour, minute] = legacy;
  const pad = part => part.padStart(2, '0');
  return Date.parse(year + '-' + pad(month) + '-' + pad(day) + 'T' + pad(hour) + ':' + minute + ':00-05:00');
}

export function preparationStartedAt(order) {
  return parsePreparationTime(order.preparationStartedAt || order.approvedAt);
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
      order, time: parsePreparationTime(order.stationCompletedAt?.[station] || order.completedAt)
    }))
    .filter(({ order, time }) => (!query || [order.code, order.num, order.table].some(value =>
      normalizeSearch(value).includes(query))) && (!date || (Number.isFinite(time) && prepHistoryDate(time) === date)))
    .sort((a, b) => (Number.isFinite(b.time) ? b.time : -Infinity) - (Number.isFinite(a.time) ? a.time : -Infinity));
}
