function normalizeSpanishPhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('34')) {
    digits = digits.slice(2);
  }
  return digits;
}

function isValidSpanishNif(value) {
  if (!value) return false;
  const v = String(value).trim().toUpperCase();
  const dni = /^\d{8}[A-Z]$/;
  const nie = /^[XYZ]\d{7}[A-Z]$/;
  const cif = /^[ABCDEFGHJNPQRSUVW]\d{7}[A-Z0-9]$/;
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';

  if (dni.test(v)) {
    const num = parseInt(v.slice(0, 8), 10);
    return letters[num % 23] === v.slice(8);
  }
  if (nie.test(v)) {
    const map = { X: '0', Y: '1', Z: '2' };
    const num = parseInt(map[v[0]] + v.slice(1, 8), 10);
    return letters[num % 23] === v.slice(8);
  }
  if (cif.test(v)) {
    return true;
  }
  return false;
}

function isValidSpanishPhone(value) {
  const normalized = normalizeSpanishPhone(value);
  return /^\d{9}$/.test(normalized);
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function validatePedidoPayload(payload = {}, options = {}) {
  const { precios = {}, isAdminCreate = false } = options;
  const errors = [];

  const nombre = String(payload.nombre ?? '').trim();
  const telefono = normalizeSpanishPhone(payload.telefono);
  const fecha = String(payload.fecha ?? '').trim();
  const hora = String(payload.hora ?? '').trim();
  const metodoPago = String(payload.metodo_pago ?? '').trim();
  const direccion = typeof payload.direccion === 'string' ? payload.direccion : '';
  const direccionEntrega = typeof payload.direccion_entrega === 'string' ? payload.direccion_entrega : '';
  const comentarios = typeof payload.comentarios === 'string' ? payload.comentarios : '';

  if (!nombre) {
    errors.push('El nombre es obligatorio.');
  }
  if (!telefono || !isValidSpanishPhone(telefono)) {
    errors.push('El teléfono debe tener exactamente 9 dígitos.');
  }
  if (!fecha) {
    errors.push('La fecha es obligatoria.');
  }
  if (!hora) {
    errors.push('La hora es obligatoria.');
  }
  if (!metodoPago) {
    errors.push('El método de pago es obligatorio.');
  }

  const personasNum = Number(payload.personas);
  const churrosPorNum = Number(payload.churros_por_persona);
  const chocolatesNum = Number(payload.chocolates);
  const envioBool = !!payload.requiere_envio;
  const facturaBool = !!payload.solicita_factura;

  const minChurros = isAdminCreate ? 2 : 4;
  const maxChurros = isAdminCreate ? 100 : 12;
  const hasPersonas = Number.isFinite(personasNum) && personasNum > 0;
  const hasChurrosPorPersona = Number.isFinite(churrosPorNum);

  if (hasPersonas && (!hasChurrosPorPersona || churrosPorNum < minChurros || churrosPorNum > maxChurros)) {
    errors.push(`Si indicas personas, churros por persona debe estar entre ${minChurros} y ${maxChurros}.`);
  }

  if (facturaBool && (!String(payload.provincia ?? '').trim() || !String(payload.nif ?? '').trim())) {
    errors.push('Provincia y NIF son obligatorios si se solicita factura.');
  }

  if (direccion.length > 100) {
    errors.push('La dirección no puede superar 100 caracteres.');
  }
  if (direccionEntrega.length > 100) {
    errors.push('La dirección de entrega no puede superar 100 caracteres.');
  }
  if (comentarios.length > 200) {
    errors.push('Los comentarios no pueden superar 200 caracteres.');
  }

  const priceChurros = hasPersonas && hasChurrosPorPersona
    ? personasNum * churrosPorNum * Number(precios.churro || 0)
    : 0;
  const priceChoco = Number.isFinite(chocolatesNum) && chocolatesNum >= 0
    ? chocolatesNum * Number(precios.chocolate || 0)
    : 0;
  const priceEnvio = envioBool ? Number(precios.envio || 0) : 0;
  const subtotal = Number((priceChurros + priceChoco + priceEnvio).toFixed(2));

  let descuentoNum = 0;
  if (isAdminCreate && typeof payload.descuento !== 'undefined' && payload.descuento !== null && String(payload.descuento).trim() !== '') {
    descuentoNum = Number(String(payload.descuento).replace(',', '.'));
    if (!Number.isFinite(descuentoNum) || descuentoNum < 0) {
      errors.push('El descuento debe ser un número válido mayor o igual a 0.');
    }
    if (Number.isFinite(descuentoNum) && descuentoNum > subtotal) {
      errors.push('El descuento no puede ser mayor que el total del presupuesto.');
    }
  }

  const presupuestoFinal = Number((subtotal - descuentoNum).toFixed(2));
  if (!isAdminCreate && presupuestoFinal < 100) {
    errors.push('El presupuesto mínimo es 100 €.');
  }

  return {
    valid: errors.length === 0,
    errors,
    subtotal,
    descuento: descuentoNum,
    presupuestoFinal,
  };
}

module.exports = {
  normalizeSpanishPhone,
  isValidSpanishNif,
  isValidSpanishPhone,
  isValidEmail,
  validatePedidoPayload,
};
