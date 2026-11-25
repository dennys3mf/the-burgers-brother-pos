import { receiptLogo } from './receipt-logo.js';

const statusCommand = { checkPrinterStatus: [] };

async function request(url, data) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: JSON.stringify(data),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw new Error('El puente local de BIXOLON no respondió. Ábrelo y permite el acceso local si el navegador lo solicita.');
  }
  if (response.status === 404) throw new Error('El puente no encontró ese nombre de impresora.');
  if (!response.ok) throw new Error('El puente devolvió el error HTTP ' + response.status + '.');
  try {
    return await response.json();
  } catch {
    throw new Error('La respuesta del puente no tiene el formato de BIXOLON.');
  }
}

export async function runBixolon({ name, secure }, text, qrCode) {
  if (!/^[a-zA-Z0-9]{1,32}$/.test(name)) {
    throw new Error('Indica el nombre lógico registrado en BIXOLON, usando letras o números.');
  }
  const url = (secure ? 'https' : 'http') + '://127.0.0.1:18080/WebPrintSDK/' + name;
  const id = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
  const functions = { func1: statusCommand };
  if (text) {
    functions.func2 = { setCharacterset: [1252] };
    const printText = value => ({ printText: [value, 0, 0, false, false, false, 0, 0] });
    const feed = '\n\n\n\n';
    const heading = "THE BURGERS BROTHER\n";
    const brandedReceipt = !qrCode && text.startsWith(heading);
    if (brandedReceipt) {
      functions.func3 = { printBitmap: [receiptLogo, 384, 1, false] };
    }
    const comandaHeading = "COMANDA DE SERVICIO\n";
    const brandedComanda = qrCode && text.startsWith(comandaHeading);
    const body = brandedReceipt ? text.slice(heading.length) :
      brandedComanda ? text.slice(comandaHeading.length) : text;
    if (brandedComanda) {
      functions.func3 = { printText: [comandaHeading, 0, 1, true, false, false, 0, 1] };
    }
    let nextCommand = brandedComanda || brandedReceipt ? 4 : 3;
    const append = command => { functions['func' + nextCommand++] = command; };
    if (brandedComanda) {
      for (const part of body.trimEnd().split(/(^\d+x [^\n]*\n?)/m).filter(Boolean)) {
        if (/^\d+x /.test(part)) {
          append({ printText: [part.trimEnd() + '\n', 0, 0, true, false, false, 0, 0] });
        } else {
          append(printText(part.endsWith('\n') ? part : part + '\n'));
        }
      }
    } else {
      append(printText(body.trimEnd() + (qrCode ? '\n' : feed)));
    }
    if (qrCode) {
      append({ printQRCode: [qrCode, 1, 1, 6, 1] });
      append(printText(feed));
    }
  }
  let result = await request(url, { id, functions });
  for (let attempt = 0; attempt < 3 && /^(ready|progress|in progress)$/i.test(String(result?.Result).trim()); attempt++) {
    if (result.ResponseID == null) break;
    result = await request(url + '/checkStatus', {
      RequestID: result.RequestID ?? id,
      ResponseID: result.ResponseID,
      Timeout: 5
    });
  }
  const status = String(result?.Result ?? '').trim();
  if (!/^(success|ok|complete|completed|0)$/i.test(status)) {
    throw new Error(status ? 'Respuesta de BIXOLON: ' + status.slice(0, 160) : 'BIXOLON no confirmó el resultado.');
  }
}

export function thermalReceiptText(order, issuedAt) {
  const total = Number(order.total);
  const subtotal = total / 1.18;
  const amount = value => 'S/ ' + value.toFixed(2);
  const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  const width = 42;
  const wrap = value => clean(value).match(/.{1,42}(?:\s|$)|.{1,42}/g)?.map(line => line.trim()) || [];
  const pair = (label, value) => label.padEnd(Math.max(label.length + 1, width - value.length)) + value;
  const rule = '-'.repeat(width);
  return [
    'THE BURGERS BROTHER',
    'Pedidos / WhatsApp: 958656930',
    'Arequipa, Perú',
    rule,
    'BOLETA INTERNA DE VENTA',
    clean(order.boletaNum),
    ...wrap('Pedido: ' + order.code + ' (' + (order.channel === 'MESA' ? order.table + (order.takeaway ? ' · Para llevar' : '') : 'Delivery') + ')'),
    ...wrap('Cliente: ' + order.customer),
    ...(order.channel === 'DELIVERY' && order.address ? wrap('Dirección: ' + order.address) : []),
    ...(issuedAt ? wrap('Fecha: ' + issuedAt) : []),
    rule,
    ...order.items.flatMap(item => [
      ...wrap(item.qty + ' x ' + item.name),
      pair('Importe', amount(item.qty * item.unitPrice)),
      ...(item.extras?.length ? wrap('+ ' + item.extras.map(extra => extra.name).join(', ')) : [])
    ]),
    rule,
    pair('Operación gravada', amount(subtotal)),
    pair('IGV (18%)', amount(total - subtotal)),
    pair('TOTAL', amount(total)),
    ...wrap('Pago: ' + order.paymentMethod + ' (' + order.paymentStatus + ')'),
    rule,
    'Documento de control interno',
    'No válido como comprobante SUNAT'
  ].join('\n');
}
