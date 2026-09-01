const { normalizeSpanishPhone } = require('./validations');

// Mirrors the logic in private/crear_pedido.html (selector de cliente).
// Manten sincronizados ambos lugares si se modifica el criterio de selección.
function pickPedidoMasRecienteRealizado(actual, candidato) {
  if (!actual) return candidato;

  const tActual = Date.parse(String(actual?.created_at || ''));
  const tCandidato = Date.parse(String(candidato?.created_at || ''));
  const hasActual = Number.isFinite(tActual);
  const hasCandidato = Number.isFinite(tCandidato);

  if (hasActual && hasCandidato) {
    if (tCandidato > tActual) return candidato;
    if (tCandidato < tActual) return actual;
  } else if (hasCandidato && !hasActual) {
    return candidato;
  } else if (!hasCandidato && hasActual) {
    return actual;
  }

  return Number(candidato.id || 0) > Number(actual.id || 0) ? candidato : actual;
}

// Construye los valores de formulario a partir del último pedido del cliente.
// La fecha NUNCA se rellena (debe elegirse de nuevo) y el descuento solo se
// incluye si el pedido original tenía uno aplicado.
function buildFormValuesFromPedido(pedido, cliente) {
  if (!pedido) return null;

  const telPedido = normalizeSpanishPhone(pedido.telefono || '');
  const basePersonal = cliente || {};

  return {
    nombre: basePersonal.nombre || pedido.nombre || '',
    telefono: normalizeSpanishPhone(basePersonal.telefono || telPedido),
    nif: basePersonal.nif || '',
    email: basePersonal.email || '',
    cp: basePersonal.cp || '',
    direccion: basePersonal.direccion || '',
    ciudad: basePersonal.ciudad || '',
    provincia: basePersonal.provincia || '',
    personas: Number.isFinite(Number(pedido.personas)) ? Number(pedido.personas) : '',
    churros_por_persona: Number.isFinite(Number(pedido.churros_por_persona)) ? Number(pedido.churros_por_persona) : '',
    chocolates: Number.isFinite(Number(pedido.chocolates)) ? Number(pedido.chocolates) : '',
    fecha_text: '',
    fecha_picker: '',
    hora: pedido.hora ? String(pedido.hora).slice(0, 5) : '',
    direccion_entrega: pedido.direccion_entrega || '',
    comentarios: pedido.comentarios || '',
    descuento: Number(pedido.descuento) > 0 ? Number(pedido.descuento).toFixed(2) : '',
    solicita_factura: pedido.solicita_factura === true || pedido.solicita_factura === 1 || String(pedido.solicita_factura) === '1',
    requiere_envio: pedido.requiere_envio === true || pedido.requiere_envio === 1 || String(pedido.requiere_envio) === '1',
    metodo_pago: String(pedido.metodo_pago || '').trim(),
  };
}

module.exports = { pickPedidoMasRecienteRealizado, buildFormValuesFromPedido };
