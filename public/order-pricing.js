export const TAPER_PRICE = 1;
export const CARD_FEE_PERCENT = 5;

function charge(menuId, name, qty, unitPrice) {
  return { menuId, name, station: 'SERVICIO', qty, unitPrice, basePrice: unitPrice, extras: [], flavors: [], note: '' };
}

export function isOrderCharge(item) {
  return item.menuId === 'taper' || item.menuId === 'delivery-card-fee';
}

export function priceOrder(items, { tapers = 0, channel, paymentMethod }) {
  const cents = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.qty, 0);
  const packaging = tapers * TAPER_PRICE * 100;
  const fee = cents > 0 && channel === 'DELIVERY' && paymentMethod === 'Tarjeta'
    ? Math.round((cents + packaging) * CARD_FEE_PERCENT / 100) : 0;
  const charges = [];
  if (tapers > 0) charges.push(charge('taper', 'Táper', tapers, TAPER_PRICE));
  if (fee > 0) charges.push(charge('delivery-card-fee', 'Recargo tarjeta (5 %)', 1, fee / 100));
  return { items: [...items, ...charges], total: (cents + (cents ? packaging : 0) + fee) / 100, fee: fee / 100 };
}
