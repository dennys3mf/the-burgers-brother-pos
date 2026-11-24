import { receiptLogo } from './receipt-logo.js';

// BIXOLON paper is 80 mm wide, with a 72 mm printable area.
export function receiptPdf(Pdf, order, issuedAt) {
  const total = Number(order.total);
  const subtotal = total / 1.18;
  const amount = value => 'S/ ' + value.toFixed(2);
  const layout = new Pdf({ unit: 'mm', format: [80, 100] });
  const lines = [];
  function add(text, { bold = false, center = false, size = 9, right = '' } = {}) {
    layout.setFont('helvetica', bold ? 'bold' : 'normal');
    layout.setFontSize(size);
    const lineWidth = 72 - (right ? layout.getTextWidth(right) + 3 : 0);
    layout.splitTextToSize(String(text), lineWidth).forEach((line, index) => {
      lines.push({ line, right: index === 0 ? right : '', bold, center, size });
    });
  }
  const rule = () => lines.push({ rule: true });
  lines.push({ logo: true });
  add('Pedidos / WhatsApp: 958656930', { center: true });
  add('Arequipa, Perú', { center: true });
  rule();
  add('BOLETA INTERNA DE VENTA', { bold: true, center: true });
  add(order.boletaNum, { bold: true, center: true });
  add('Pedido: ' + order.code + ' (' + (order.channel === 'MESA' ? order.table : 'Delivery') + ')');
  add('Cliente: ' + order.customer);
  if (order.channel === 'DELIVERY' && order.address) add('Dirección: ' + order.address);
  if (issuedAt) add('Fecha: ' + issuedAt);
  rule();
  for (const item of order.items) {
    add(item.qty + ' × ' + item.name, { right: amount(item.qty * item.unitPrice) });
    if (item.extras?.length) add('+ ' + item.extras.map(extra => extra.name).join(', '), { size: 8 });
  }
  rule();
  add('Operación gravada', { right: amount(subtotal) });
  add('IGV (18%)', { right: amount(total - subtotal) });
  add('TOTAL', { right: amount(total), bold: true, size: 11 });
  add('Pago: ' + order.paymentMethod + ' (' + order.paymentStatus + ')');
  rule();
  add('Documento de control interno', { center: true, size: 8 });
  add('No válido como comprobante SUNAT', { center: true, size: 8 });

  // Keep long receipts within limits of mobile PDF viewers and print services.
  const heightOf = row => row.logo ? 32 : row.rule ? 4 : row.size * .46;
  const chunks = [[]];
  let height = 0;
  for (const row of lines) {
    if (height + heightOf(row) > 270) {
      chunks.push([]);
      height = 0;
    }
    chunks.at(-1).push(row);
    height += heightOf(row);
  }
  const format = rows => [80, Math.max(80, 12 + rows.reduce((sum, row) => sum + heightOf(row), 0))];
  const doc = new Pdf({ unit: 'mm', format: format(chunks[0]), compress: true });
  chunks.forEach((rows, page) => {
    if (page) doc.addPage(format(rows), 'portrait');
    let y = 7;
    for (const row of rows) {
      if (row.logo) {
        doc.addImage(receiptLogo, 'PNG', 16, y - 3, 48, 48 * 235 / 384);
      } else if (row.rule) {
        doc.setDrawColor(0);
        doc.line(4, y - 1.5, 76, y - 1.5);
      } else {
        doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
        doc.setFontSize(row.size);
        doc.text(row.line, row.center ? 40 : 4, y, { align: row.center ? 'center' : 'left' });
        if (row.right) doc.text(row.right, 76, y, { align: 'right' });
      }
      y += heightOf(row);
    }
  });
  return doc.output('blob');
}
