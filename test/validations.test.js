const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeSpanishPhone,
  isValidSpanishNif,
  isValidSpanishPhone,
  isValidEmail,
  validatePedidoPayload,
} = require('../utils/validations');

test('normalizeSpanishPhone elimina prefijo internacional y deja 9 dígitos', () => {
  assert.equal(normalizeSpanishPhone('+34 612 345 678'), '612345678');
  assert.equal(normalizeSpanishPhone('612345678'), '612345678');
  assert.equal(normalizeSpanishPhone('  612-345-678  '), '612345678');
});

test('isValidSpanishPhone acepta solo teléfonos de 9 dígitos', () => {
  assert.equal(isValidSpanishPhone('612345678'), true);
  assert.equal(isValidSpanishPhone('+34 612345678'), true);
  assert.equal(isValidSpanishPhone('61234'), false);
  assert.equal(isValidSpanishPhone('61234567a'), false);
});

test('isValidSpanishNif valida DNI, NIE y CIF reales', () => {
  assert.equal(isValidSpanishNif('12345678Z'), true);
  assert.equal(isValidSpanishNif('X1234567L'), true);
  assert.equal(isValidSpanishNif('B12345678'), true);
  assert.equal(isValidSpanishNif('12345678A'), false);
  assert.equal(isValidSpanishNif('99999999Z'), false);
});

test('isValidEmail valida correos con formato estándar', () => {
  assert.equal(isValidEmail('cliente@ejemplo.com'), true);
  assert.equal(isValidEmail('cliente@ejemplo'), false);
  assert.equal(isValidEmail('cliente.com'), false);
  assert.equal(isValidEmail(''), false);
});

test('validatePedidoPayload exige campos obligatorios y validaciones del pedido', () => {
  const normalizeText = (value = '') =>
    String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const containsError = (errors, token) =>
    errors.some((err) => normalizeText(err).includes(normalizeText(token)));

  const valid = validatePedidoPayload({
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  }, { precios: { churro: 1.2, chocolate: 1.1, envio: 3.5 }, isAdminCreate: false });

  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, []);

  const invalid = validatePedidoPayload({
    nombre: '',
    telefono: '123',
    fecha: '',
    hora: '18:00',
    metodo_pago: '',
    personas: 2,
    churros_por_persona: 2,
  }, { precios: { churro: 1.2, chocolate: 1.1, envio: 3.5 }, isAdminCreate: false });

  assert.equal(invalid.valid, false);
  assert.ok(containsError(invalid.errors, 'nombre'));
  assert.ok(containsError(invalid.errors, 'telefono'));
  assert.ok(containsError(invalid.errors, 'fecha'));
  assert.ok(containsError(invalid.errors, 'metodo'));

  const factura = validatePedidoPayload({
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'tarjeta',
    solicita_factura: true,
    provincia: '',
    nif: '',
  }, { precios: { churro: 1.2, chocolate: 1.1, envio: 3.5 }, isAdminCreate: false });

  assert.equal(factura.valid, false);
  assert.ok(containsError(factura.errors, 'factura'));

  const budget = validatePedidoPayload({
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'tarjeta',
    personas: 1,
    churros_por_persona: 4,
  }, { precios: { churro: 1.2, chocolate: 1.1, envio: 3.5 }, isAdminCreate: false });

  assert.equal(budget.valid, false);
  assert.ok(containsError(budget.errors, 'presupuesto'));
});
