export const STATIONS = ['COCINA', 'BARRA'];

export function orderStations(order) {
  const stations = STATIONS.filter(station => order.items.some(item => item.station === station));
  return stations.length ? stations : ['COCINA'];
}

export function stationReady(order, station) {
  return order.status === 'LISTO_CHEF' || Boolean(order.stationCompletedAt?.[station]);
}

export function preparationStartedAt(order) {
  if (order.preparationStartedAt) return Date.parse(order.preparationStartedAt);
  const legacy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(order.approvedAt || '');
  if (!legacy) return Date.parse(order.approvedAt);
  const [, day, month, year, hour, minute] = legacy;
  const pad = value => value.padStart(2, '0');
  return Date.parse(year + '-' + pad(month) + '-' + pad(day) + 'T' + pad(hour) + ':' + minute + ':00-05:00');
}
