const test = require('node:test');
const assert = require('node:assert/strict');
const { pickPedidoMasRecienteRealizado, buildFormValuesFromPedido } = require('../utils/clientePicker');

test('pickPedidoMasRecienteRealizado elige el pedido con created_at más reciente', () => {
  const antiguo = { id: 1, created_at: '2026-01-01T10:00:00Z' };
  const reciente = { id: 2, created_at: '2026-06-01T10:00:00Z' };

  assert.equal(pickPedidoMasRecienteRealizado(antiguo, reciente), reciente);
  assert.equal(pickPedidoMasRecienteRealizado(reciente, antiguo), reciente);
});

test('pickPedidoMasRecienteRealizado usa el id como desempate si no hay created_at válido', () => {
  const a = { id: 5 };
  const b = { id: 8 };

  assert.equal(pickPedidoMasRecienteRealizado(a, b), b);
  assert.equal(pickPedidoMasRecienteRealizado(b, a), b);
});

test('pickPedidoMasRecienteRealizado devuelve el candidato si no hay pedido actual', () => {
  const candidato = { id: 1 };
  assert.equal(pickPedidoMasRecienteRealizado(null, candidato), candidato);
});

test('buildFormValuesFromPedido rellena los datos del último pedido excepto la fecha', () => {
  const pedido = {
    nombre: 'Cliente Test',
    telefono: '612345678',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 2,
    fecha: '2026-01-15',
    hora: '18:30:00',
    direccion_entrega: 'Calle Falsa 123',
    comentarios: 'Sin gluten',
    descuento: 0,
    solicita_factura: 1,
    requiere_envio: 1,
    metodo_pago: 'efectivo',
  };

  const valores = buildFormValuesFromPedido(pedido, null);

  assert.equal(valores.nombre, 'Cliente Test');
  assert.equal(valores.telefono, '612345678');
  assert.equal(valores.personas, 10);
  assert.equal(valores.churros_por_persona, 12);
  assert.equal(valores.chocolates, 2);
  assert.equal(valores.hora, '18:30');
  assert.equal(valores.direccion_entrega, 'Calle Falsa 123');
  assert.equal(valores.comentarios, 'Sin gluten');
  assert.equal(valores.metodo_pago, 'efectivo');
  assert.equal(valores.solicita_factura, true);
  assert.equal(valores.requiere_envio, true);

  // La fecha nunca se rellena automáticamente
  assert.equal(valores.fecha_text, '');
  assert.equal(valores.fecha_picker, '');
});

test('buildFormValuesFromPedido respeta el descuento del último pedido si existe', () => {
  const conDescuento = buildFormValuesFromPedido({ nombre: 'X', telefono: '600000000', descuento: 15 }, null);
  assert.equal(conDescuento.descuento, '15.00');

  const sinDescuento = buildFormValuesFromPedido({ nombre: 'X', telefono: '600000000', descuento: 0 }, null);
  assert.equal(sinDescuento.descuento, '');

  const sinCampo = buildFormValuesFromPedido({ nombre: 'X', telefono: '600000000' }, null);
  assert.equal(sinCampo.descuento, '');
});

test('buildFormValuesFromPedido prioriza los datos personales del cliente sobre los del pedido', () => {
  const pedido = { nombre: 'Nombre Pedido', telefono: '611111111' };
  const cliente = { nombre: 'Nombre Cliente Actualizado', telefono: '622222222', nif: '12345678Z', email: 'c@c.com' };

  const valores = buildFormValuesFromPedido(pedido, cliente);

  assert.equal(valores.nombre, 'Nombre Cliente Actualizado');
  assert.equal(valores.telefono, '622222222');
  assert.equal(valores.nif, '12345678Z');
  assert.equal(valores.email, 'c@c.com');
});
