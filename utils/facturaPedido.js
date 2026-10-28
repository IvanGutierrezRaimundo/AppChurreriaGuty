// Generación de factura PDF de un pedido. Compartido por Pedidos e Historial de pedidos.
// Requiere en la página (ámbito global): jsPDF (window.jspdf), showActionAlert, askActionConfirm, formatDate,
// y los autoTable de jspdf-autotable. downloadFacturaPdf devuelve true si ha generado un Nº de factura nuevo
// (la página debe recargar su lista).

const FACTURA_IVA_RATE_PRODUCTOS = 0.10;
const FACTURA_IVA_RATE_ENVIO = 0.21;
// Precios vigentes (con IVA), cargados siempre desde la base de datos (nunca hardcodeados aquí).
let preciosCache = null;
async function getPrecios(){
  if(preciosCache) return preciosCache;
  const resp = await fetch('/api/precios');
  const data = await resp.json().catch(() => ({}));
  if(!resp.ok || data.ok === false || !data.precios){
    throw new Error(data.error || 'No se pudieron cargar los precios.');
  }
  preciosCache = {
    churro: Number(data.precios.churro),
    chocolate: Number(data.precios.chocolate),
    envio: Number(data.precios.envio)
  };
  return preciosCache;
}

function roundMoney(value){
  return Number((Number(value || 0)).toFixed(2));
}

function formatMoney(value){
  return `${roundMoney(value).toFixed(2).replace('.', ',')} €`;
}

function formatUnitMoney(value){
  const num = Number(value || 0);
  const truncated = Math.trunc(num * 1000) / 1000;
  return `${truncated.toFixed(3).replace('.', ',')} €`;
}

function formatInvoiceDate(value){
  if(!value) return formatDate(new Date());
  return formatDate(value);
}

function generateFacturaNumero(pedido){
  if(pedido?.numero != null && pedido?.anio != null) return `${pedido.numero}/${pedido.anio}`;
  const fechaRaw = String(pedido?.fecha || '').trim();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? new Date(fechaRaw) : new Date();
  const anio = fecha.getFullYear();
  const numeroPedido = String(pedido?.id || '').trim();
  return numeroPedido ? `${numeroPedido}/${anio}` : `${anio}`;
}

async function fetchPedidoById(id){
  const resp = await fetch(`/admin/api/pedidos/${id}`, { credentials: 'same-origin' });
  if(resp.status === 401) throw new Error('SESSION');
  const data = await resp.json().catch(() => ({}));
  if(!data || !data.ok || !data.data) throw new Error(data?.error || 'No se pudo cargar el pedido');
  return data.data;
}

async function loadFacturaLogo(){
  try {
    const resp = await fetch('/img/logo_nuevo_churre.jpeg', { cache: 'no-store' });
    if(!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer el logo'));
      reader.readAsDataURL(blob);
    });
  } catch(_err){
    return null;
  }
}

async function buildFacturaItems(pedido){
  const items = [];
  // La factura usa el precio congelado en el pedido (fijado al crearlo/editarlo), nunca el precio vigente:
  // así una factura ya emitida no cambia si luego se actualizan los precios globales.
  // Ojo: Number(null) es 0 (no NaN), por eso se comprueba null/undefined explícitamente antes de convertir.
  const tieneValor = (v) => v !== null && typeof v !== 'undefined' && Number.isFinite(Number(v));
  const tieneSnapshot = tieneValor(pedido?.precio_churro) && tieneValor(pedido?.precio_chocolate) && tieneValor(pedido?.precio_envio);
  const precios = tieneSnapshot
    ? { churro: Number(pedido.precio_churro), chocolate: Number(pedido.precio_chocolate), envio: Number(pedido.precio_envio) }
    : await getPrecios(); // Solo para pedidos antiguos creados antes de guardar el snapshot.
  const personas = Number(pedido?.personas || 0);
  const churrosPorPersona = Number(pedido?.churros_por_persona || 0);
  const chocolates = Number(pedido?.chocolates || 0);
  const requiereEnvio = !!pedido?.requiere_envio;

  const cantidadChurros = Number.isFinite(personas) && Number.isFinite(churrosPorPersona)
    ? Math.max(0, roundMoney(personas * churrosPorPersona))
    : 0;
  if(cantidadChurros > 0){
    items.push({
      concepto: 'Churros',
      cantidad: cantidadChurros,
      precioUnitarioSinIva: precios.churro / (1 + FACTURA_IVA_RATE_PRODUCTOS),
      ivaRate: FACTURA_IVA_RATE_PRODUCTOS,
      esEnvio: false
    });
  }

  const cantidadChocolate = Number.isFinite(chocolates) ? Math.max(0, roundMoney(chocolates)) : 0;
  if(cantidadChocolate > 0){
    items.push({
      concepto: 'Chocolate',
      cantidad: cantidadChocolate,
      precioUnitarioSinIva: precios.chocolate / (1 + FACTURA_IVA_RATE_PRODUCTOS),
      ivaRate: FACTURA_IVA_RATE_PRODUCTOS,
      esEnvio: false
    });
  }

  if(requiereEnvio){
    items.push({
      concepto: 'Gestión de envases',
      cantidad: 1,
      precioUnitarioSinIva: precios.envio / (1 + FACTURA_IVA_RATE_ENVIO),
      ivaRate: FACTURA_IVA_RATE_ENVIO,
      esEnvio: true
    });
  }

  return items.map((item) => {
    const precioUnitarioSinIva = Number(item.precioUnitarioSinIva || 0);
    const totalSinIva = roundMoney(precioUnitarioSinIva * item.cantidad);
    const ivaImporte = roundMoney(totalSinIva * item.ivaRate);
    const totalConIva = roundMoney(totalSinIva + ivaImporte);
    return {
      ...item,
      precioUnitarioSinIva,
      totalSinIva,
      ivaImporte,
      totalConIva
    };
  });
}

async function downloadFacturaPdf(pedidoId){
  let pedido = null;
  try {
    pedido = await fetchPedidoById(pedidoId);
  } catch(err){
    if(err && err.message === 'SESSION'){
      location.href = '/admin';
      return;
    }
    await showActionAlert({ title: 'Error', message: 'No se pudo cargar el pedido para generar la factura.' });
    return;
  }

  const estado = String(pedido?.estado || '').trim().toLowerCase();
  // Un pedido cancelado solo tiene factura (marcada CANCELADA) si llegó a numerarse al estar Realizado.
  const cancelConNumero = estado === 'cancelado' && pedido?.numero != null;
  if(estado !== 'realizado' && estado !== 'cobrado' && !cancelConNumero){
    await showActionAlert({
      title: 'Aviso',
      message: 'Sólo se pueden generar facturas con estado realizado o cobrado'
    });
    return false;
  }

  // Pedido sin Nº de factura (no la solicitó): solo se numera de forma excepcional, a petición del admin.
  let numeroRecienGenerado = false;
  if(pedido?.numero == null && !cancelConNumero){
    if(!pedido?.solicita_factura){
      await showActionAlert({
        title: 'Aviso',
        message: 'Este pedido no solicita factura. Edita el pedido, activa "Solicita factura" y rellena el NIF y la provincia antes de generarla.'
      });
      return false;
    }
    if(!pedido?.nif || !pedido?.provincia){
      await showActionAlert({
        title: 'Aviso',
        message: 'Faltan el NIF o la provincia del cliente. Edita el pedido y rellénalos antes de generar la factura.'
      });
      return false;
    }
    const confirmado = await askActionConfirm({
      title: 'Importante',
      message: 'Este pedido no necesitaba factura. ¿Está seguro de generarla?\n\nSi no es la última, después solo podrá cancelarla y no eliminarla.',
      acceptText: 'Generar factura'
    });
    if(!confirmado) return false;
    try {
      const resp = await fetch(`/admin/api/pedidos/${pedidoId}/factura`, { method: 'POST', credentials: 'same-origin' });
      if(resp.status === 401){
        location.href = '/admin';
        return false;
      }
      const data = await resp.json().catch(() => ({}));
      if(!resp.ok || !data.ok || !data.data){
        await showActionAlert({ title: 'Error', message: data?.error || 'No se pudo generar el número de factura.' });
        return false;
      }
      pedido = data.data;
      numeroRecienGenerado = true;
    } catch(_err){
      await showActionAlert({ title: 'Error', message: 'No se pudo generar el número de factura.' });
      return false;
    }
  }

  if(!window.jspdf || !window.jspdf.jsPDF || typeof window.jspdf.jsPDF !== 'function'){
    await showActionAlert({ title: 'Error', message: 'No se pudo cargar la librería PDF. Inténtalo de nuevo.' });
    return numeroRecienGenerado;
  }

  const items = await buildFacturaItems(pedido);
  if(items.length === 0){
    await showActionAlert({ title: 'Aviso', message: 'El pedido no tiene conceptos facturables para generar la factura.' });
    return numeroRecienGenerado;
  }

  const envioItem = items.find((item) => item.esEnvio);
  const productosItems = items.filter((item) => !item.esEnvio);
  const baseProductosSinIva = roundMoney(productosItems.reduce((acc, item) => acc + item.totalSinIva, 0));
  const ivaProductosBase = roundMoney(productosItems.reduce((acc, item) => acc + item.ivaImporte, 0));
  const baseEnvioSinIva = roundMoney(envioItem ? envioItem.totalSinIva : 0);
  const ivaEnvio = roundMoney(envioItem ? envioItem.ivaImporte : 0);
  const totalProductosConIvaBase = roundMoney(baseProductosSinIva + ivaProductosBase);
  const totalEnvasesConIva = roundMoney(baseEnvioSinIva + ivaEnvio);
  // El descuento se lee directamente del pedido (no se reconstruye por diferencia de redondeo).
  const descuentoImporte = roundMoney(Math.max(0, Number(pedido?.descuento) || 0));
  // El suplemento (introducido con IVA) se suma a la base de productos y tributa al mismo tipo.
  const suplementoImporte = roundMoney(Math.max(0, Number(pedido?.suplemento) || 0));
  const suplementoSinIva = suplementoImporte > 0 ? roundMoney(suplementoImporte / (1 + FACTURA_IVA_RATE_PRODUCTOS)) : 0;
  const baseProductosConSuplemento = roundMoney(baseProductosSinIva + suplementoSinIva);
  // Base imponible de productos: tras sumar el suplemento y restar el descuento.
  let baseProductosSinIvaConDescuento = baseProductosConSuplemento;
  let ivaProductos = ivaProductosBase;
  if(descuentoImporte > 0 || suplementoImporte > 0){
    const totalProductosConIvaFinal = roundMoney(Math.max(0, totalProductosConIvaBase + suplementoImporte - descuentoImporte));
    if(descuentoImporte > 0){
      baseProductosSinIvaConDescuento = roundMoney(Math.max(0, totalProductosConIvaFinal / (1 + FACTURA_IVA_RATE_PRODUCTOS)));
    }
    // Ajusta el IVA como complemento del total con IVA para evitar desfases de 0,01 por redondeo.
    ivaProductos = roundMoney(totalProductosConIvaFinal - baseProductosSinIvaConDescuento);
  }
  const subtotalSinIva = roundMoney(baseProductosSinIvaConDescuento + baseEnvioSinIva);
  const ivaTotal = roundMoney(ivaProductos + ivaEnvio);
  const totalConIva = roundMoney(subtotalSinIva + ivaTotal);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const logoDataUrl = await loadFacturaLogo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoBox = { x: pageWidth - 40 - 260, y: 24, maxW: 260, maxH: 130 };

  const empresaLineas = [
    'Roizmundo C.B.',
    'N.I.F. E44632735',
    'C/General Elorza nº69',
    '33002 Oviedo',
    'Tlfn: 985221435'
  ];

  let y = 48;
  if(logoDataUrl){
    try {
      const logoProps = doc.getImageProperties(logoDataUrl);
      const logoW = Number(logoProps?.width) || logoBox.maxW;
      const logoH = Number(logoProps?.height) || logoBox.maxH;
      const scale = Math.min(logoBox.maxW / logoW, logoBox.maxH / logoH);
      const drawW = logoW * scale;
      const drawH = logoH * scale;
      const drawX = pageWidth - 40 - drawW;
      const drawY = logoBox.y + ((logoBox.maxH - drawH) / 2);
      doc.addImage(logoDataUrl, 'JPEG', drawX, drawY, drawW, drawH);
    } catch(_err){
      // Si falla el logo, la factura se genera igualmente.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FACTURA', 40, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  empresaLineas.forEach((linea) => {
    doc.text(linea, 40, y);
    y += 14;
  });

  const facturaNumero = generateFacturaNumero(pedido);
  // Factura generada a posteriori: se muestran la fecha del pedido y, debajo, la fecha de facturación.
  const fechaFacturacion = pedido.fecha_facturacion ? formatInvoiceDate(pedido.fecha_facturacion) : null;
  const bloqueFacturaY = fechaFacturacion ? 152 : 170;
  doc.setFont('helvetica', 'bold');
  doc.text('Número de factura:', 40, bloqueFacturaY);
  doc.text(fechaFacturacion ? 'Fecha del pedido:' : 'Fecha:', 40, bloqueFacturaY + 18);
  if(fechaFacturacion) doc.text('Fecha de facturación:', 40, bloqueFacturaY + 36);
  doc.setFont('helvetica', 'normal');
  doc.text(facturaNumero, 170, bloqueFacturaY);
  doc.text(formatInvoiceDate(pedido.fecha), fechaFacturacion ? 190 : 170, bloqueFacturaY + 18);
  if(fechaFacturacion) doc.text(fechaFacturacion, 190, bloqueFacturaY + 36);

  const clienteY = 210;
  doc.setDrawColor(210, 210, 210);
  doc.rect(40, clienteY, pageWidth - 80, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Datos del cliente', 50, clienteY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const clienteLineas = [
    `Nombre: ${pedido.nombre || '-'}`,
    `NIF: ${pedido.nif || '-'}`,
    `Dirección: ${pedido.direccion || '-'}${pedido.cp ? `, ${pedido.cp}` : ''}${pedido.ciudad ? `, ${pedido.ciudad}` : ''}${pedido.provincia ? `, ${pedido.provincia}` : ''}`
  ];
  let clienteLineY = clienteY + 38;
  clienteLineas.forEach((linea) => {
    const wrapped = doc.splitTextToSize(linea, pageWidth - 100);
    doc.text(wrapped, 50, clienteLineY);
    clienteLineY += wrapped.length * 13;
  });

  const bodyRows = items.map((item) => [
    item.concepto,
    String(item.cantidad),
    formatUnitMoney(item.precioUnitarioSinIva),
    formatMoney(item.totalSinIva)
  ]);

  doc.autoTable({
    startY: 320,
    head: [['Descripción / Concepto', 'Cantidad', 'Precio unidad (sin IVA)', 'Precio total (sin IVA)']],
    body: bodyRows,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [255, 210, 0], textColor: [91, 58, 46] },
    theme: 'grid'
  });

  const tableEndY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 272;
  let resumenY = tableEndY + 26;
  const resumenXLabel = pageWidth - 260;
  const resumenXValue = pageWidth - 40;

  function drawResumenLine(label, value, bold){
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, resumenXLabel, resumenY);
    doc.text(value, resumenXValue, resumenY, { align: 'right' });
    resumenY += 16;
  }

  // La base de productos se muestra íntegra; el suplemento y el descuento aparecen aparte, sin IVA.
  const descuentoSinIva = descuentoImporte > 0
    ? roundMoney(Math.max(0, baseProductosConSuplemento - baseProductosSinIvaConDescuento))
    : 0;
  drawResumenLine('Base productos (sin IVA):', formatMoney(baseProductosSinIva), false);
  if(suplementoImporte > 0){
    drawResumenLine('Suplemento día especial (sin IVA):', `+${formatMoney(suplementoSinIva)}`, false);
  }
  if(descuentoImporte > 0){
    drawResumenLine('Descuento (sin IVA):', `-${formatMoney(descuentoSinIva)}`, false);
  }
  if(descuentoImporte > 0 || suplementoImporte > 0){
    drawResumenLine('Base imponible productos:', formatMoney(baseProductosSinIvaConDescuento), false);
  }
  if(envioItem){
    drawResumenLine('Base gestión de envases (sin IVA):', formatMoney(baseEnvioSinIva), false);
  }
  drawResumenLine('IVA productos (10%):', formatMoney(ivaProductos), false);
  if(envioItem){
    drawResumenLine('IVA gestión de envases (21%):', formatMoney(ivaEnvio), false);
  }
  drawResumenLine('Subtotal (sin IVA):', formatMoney(subtotalSinIva), false);
  drawResumenLine('IVA total:', formatMoney(ivaTotal), false);
  drawResumenLine('TOTAL:', formatMoney(totalConIva), true);

  const metodoPago = String(pedido?.metodo_pago || '').trim().toLowerCase();
  const esTransferencia = metodoPago === 'transferencia' || metodoPago.includes('transferencia');
  if(esTransferencia){
    const footerY = 760;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.text('Esta factura no tendrá validez sin el recibo de ingreso a la cuenta bancaria:', 40, footerY);
    doc.text('ES50 3059 0090 0135 3459 7822 Caja Rural Asturias', 40, footerY + 12);
  }

  if(String(pedido?.estado || '').trim() === 'Cancelado'){
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    if(typeof doc.GState === 'function') doc.setGState(new doc.GState({ opacity: 0.55 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(90);
    doc.setTextColor(220, 0, 0);
    doc.text('CANCELADA', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  }

  const fileSafeNumero = String(pedido?.numero ?? pedido?.id ?? '').trim();
  const fileSafeAnio = String(pedido?.anio ?? new Date(pedido?.fecha || new Date()).getFullYear() ?? '').trim();
  const fileSafeCliente = String(pedido?.nombre || 'cliente').trim().replace(/[^A-Za-z0-9.-]/g, '_');
  doc.save(`${fileSafeNumero}-${fileSafeAnio}-${fileSafeCliente}.pdf`);
  return numeroRecienGenerado;
}
