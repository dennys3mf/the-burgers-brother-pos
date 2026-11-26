
import { receiptLogo } from './receipt-logo.js';

const statusCommand = { checkPrinterStatus: [] };

const wait = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function request(url, data) {
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      targetAddressSpace: 'loopback',
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    throw new Error(
      'No se pudo comunicar con BIXOLON por HTTPS. ' +
      'Verifica que WebPrintSDK esté abierto y que Chrome permita ' +
      'el acceso a la red local. Detalle: ' +
      (error?.message || 'Error de conexión')
    );
  }

  if (response.status === 404) {
    throw new Error(
      'BIXOLON no encontró ese nombre de impresora.'
    );
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      'Error HTTP ' + response.status + ': ' +
      responseText.slice(0, 200)
    );
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(
      'BIXOLON devolvió una respuesta no válida: ' +
      responseText.slice(0, 200)
    );
  }
}

function getStatus(result) {
  return String(result?.Result ?? '')
    .trim()
    .toLowerCase();
}

function isPending(status) {
  return /^(ready|progress|in progress|timeout)$/i.test(status);
}

function isSuccessful(status) {
  return /^(success|ok|complete|completed|0)$/i.test(status);
}

export async function runBixolon(
  { name, secure },
  text,
  qrCode
) {
  if (!/^[a-zA-Z0-9]{1,32}$/.test(name)) {
    throw new Error(
      'Indica el nombre lógico de la impresora registrado en BIXOLON.'
    );
  }

  const url =
    (secure ? 'https' : 'http') +
    '://127.0.0.1:18080/WebPrintSDK/' + name;

  const id =
    crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;

  const functions = {
    func1: statusCommand
  };

  if (text) {
    functions.func2 = {
      setCharacterset: [1252]
    };

    const printText = value => ({
      printText: [
        value,
        0, 0,
        false, false, false,
        0, 0
      ]
    });

    const feed = '\n\n\n\n';
    const heading = 'THE BURGERS BROTHER\n';

    const brandedReceipt =
      !qrCode && text.startsWith(heading);

    if (brandedReceipt) {
      functions.func3 = {
        printBitmap: [
          receiptLogo,
          384,
          1,
          false
        ]
      };
    }

    const comandaHeading = 'COMANDA DE SERVICIO\n';

    const brandedComanda =
      Boolean(qrCode) && text.startsWith(comandaHeading);

    const body = brandedReceipt
      ? text.slice(heading.length)
      : brandedComanda
        ? text.slice(comandaHeading.length)
        : text;

    if (brandedComanda) {
      functions.func3 = {
        printText: [
          comandaHeading,
          0, 1,
          true, false, false,
          0, 1
        ]
      };
    }

    let nextCommand =
      brandedComanda || brandedReceipt ? 4 : 3;

    const append = command => {
      functions['func' + nextCommand++] = command;
    };

    if (brandedComanda) {
      const parts = body.trimEnd()
        .split(/(^\d+x [^\n]*\n?)/m)
        .filter(Boolean);

      for (const part of parts) {
        if (/^\d+x /.test(part)) {
          append({
            printText: [
              part.trimEnd() + '\n',
              0, 0,
              true, false, false,
              0, 0
            ]
          });
        } else {
          append(
            printText(
              part.endsWith('\n') ? part : part + '\n'
            )
          );
        }
      }
    } else {
      append(
        printText(
          body.trimEnd() + (qrCode ? '\n' : feed)
        )
      );
    }

    if (qrCode) {
      append({
        printQRCode: [
          qrCode,
          1, 1,
          brandedComanda ? 5 : 6,
          1
        ]
      });

      append(printText(feed));
    }
  }

  // 1. Enviar el trabajo de impresión UNA sola vez.
  let result = await request(url, {
    id,
    functions
  });

  let status = getStatus(result);

  // 2. Comprobación de disponibilidad sin imprimir.
  if (!text) {
    if (isSuccessful(status) || status === 'ready') {
      return;
    }

    throw new Error(
      'Estado de BIXOLON: ' +
      (status || 'sin respuesta')
    );
  }

  // 3. Consultar el resultado de impresión.
  // Nunca volver a enviar el ticket durante estas consultas.
  const responseId = result?.ResponseID;
  const requestId = result?.RequestID ?? id;

  if (responseId == null) {
    if (isSuccessful(status)) {
      return;
    }

    throw new Error(
      'BIXOLON recibió la solicitud, pero no devolvió ' +
      'un ResponseID. Revisa la impresora antes de reenviar.'
    );
  }

  let attempts = 0;
  const maxAttempts = 8;

  while (isPending(status) && attempts < maxAttempts) {
    attempts++;

    await wait(300);

    result = await request(url + '/checkStatus', {
      RequestID: requestId,
      ResponseID: responseId,
      Timeout: 5
    });

    status = getStatus(result);
  }

  // 4. Resultado final.
  if (isSuccessful(status)) {
    return;
  }

  if (isPending(status)) {
    throw new Error(
      'BIXOLON todavía no confirmó la impresión. ' +
      'Revisa si salió el ticket antes de reenviar. ' +
      'Último estado: ' + status
    );
  }

  throw new Error(
    'BIXOLON informó un problema de impresión: ' +
    (status || 'respuesta sin estado')
  );
}

export function thermalReceiptText(order, issuedAt) {
  const total = Number(order.total);
  const subtotal = total / 1.18;

  const amount = value =>
    'S/ ' + value.toFixed(2);

  const clean = value =>
    String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim();

  const width = 42;

  const wrap = value =>
    clean(value).match(/.{1,42}(?:\s|$)|.{1,42}/g)
      ?.map(line => line.trim()) || [];

  const pair = (label, value) =>
    label.padEnd(
      Math.max(
        label.length + 1,
        width - value.length
      )
    ) + value;

  const rule = '-'.repeat(width);

  return [
    'THE BURGERS BROTHER',
    'Pedidos / WhatsApp: 958656930',
    'Arequipa, Perú',
    rule,
    'BOLETA INTERNA DE VENTA',
    clean(order.boletaNum),
    ...wrap(
      'Pedido: ' + order.code +
      ' (' +
      (order.channel === 'MESA'
        ? order.table +
          (order.takeaway ? ' · Para llevar' : '')
        : 'Delivery') +
      ')'
    ),
    ...wrap('Cliente: ' + order.customer),
    ...(order.channel === 'DELIVERY' && order.address
      ? wrap('Dirección: ' + order.address)
      : []),
    ...(issuedAt ? wrap('Fecha: ' + issuedAt) : []),
    rule,
    ...order.items.flatMap(item => [
      ...wrap(item.qty + ' x ' + item.name),
      pair(
        'Importe',
        amount(item.qty * item.unitPrice)
      ),
      ...(item.extras?.length
        ? wrap(
            '+ ' +
            item.extras.map(extra => extra.name).join(', ')
          )
        : [])
    ]),
    rule,
    pair('Operación gravada', amount(subtotal)),
    pair('IGV (18%)', amount(total - subtotal)),
    pair('TOTAL', amount(total)),
    ...wrap(
      'Pago: ' + order.paymentMethod +
      ' (' + order.paymentStatus + ')'
    ),
    rule,
    'Documento de control interno',
    'No válido como comprobante SUNAT'
  ].join('\n');
}
