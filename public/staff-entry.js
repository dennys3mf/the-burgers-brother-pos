export function preparationEntry(params) {
  const code = params.get('chef')?.trim().toUpperCase().replace(/^BB-/, '') || '';
  const station = params.get('estacion');
  if (station === 'barra' || station === 'cocina') return new URLSearchParams({ estacion: station });
  if (/^[A-Z0-9]{1,12}$/.test(code)) return new URLSearchParams({ chef: code });
  return null;
}

export function staffLoginUrl(hash = '') {
  const preparation = preparationEntry(new URLSearchParams(hash.slice(1)));
  return './personal/' + (preparation ? '?' + preparation : '');
}
