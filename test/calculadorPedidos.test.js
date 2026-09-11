const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_EQUIV_CONFIG,
  calculatePedidoResultados,
} = require('../utils/calculadorPedidosLogic');

test('calculador de pedidos usa bien las equivalencias por defecto en un ejemplo real', () => {
  const resultados = calculatePedidoResultados(1728, 168, DEFAULT_EQUIV_CONFIG);

  assert.equal(resultados.bolsas, 72);
  assert.equal(resultados.cajas, 6);
  assert.equal(Number(resultados.bidonesDecimal.toFixed(2)), 3.36);
  assert.equal(resultados.bidones, 3);
  assert.equal(Number(resultados.jarras.toFixed(2)), 1.29);
  assert.equal(resultados.litrosChocolate, 24);
  assert.equal(resultados.tuppersChocolatePuro, 3);
  assert.equal(Number(resultados.cazosNormales.toFixed(2)), 1.68);
  assert.equal(resultados.cazosPuros, 1);
  assert.equal(Number(resultados.litrosLeche.toFixed(3)), 6.048);
  assert.equal(resultados.gramosMezclaCacaoCazoPuro, 5000);
  assert.equal(resultados.gramosMezclaCacaoCazoNormal, 4200);
  assert.equal(resultados.masas, 1);
  assert.equal(resultados.tuppersMasa, 4);
  assert.equal(resultados.tubos, 24);
  assert.equal(resultados.horas, 3);
  assert.equal(resultados.minutos, 27);
});

test('calculador de pedidos recalcula con nuevos valores de la tabla de equivalencias', () => {
  const configEditada = {
    churrosPorBolsa: 30,
    bolsasPorCaja: 10,
    chocolatesPorBidon: 60,
    vasosPorJarra: 12,
    horasPor1000Churros: 3,
    minutosPorCazo: 50,
  };

  const resultados = calculatePedidoResultados(1728, 168, configEditada);

  assert.equal(Number(resultados.bolsas.toFixed(2)), 57.6);
  assert.equal(Number(resultados.cajas.toFixed(2)), 5.76);
  assert.equal(Number(resultados.bidonesDecimal.toFixed(2)), 2.8);
  assert.equal(resultados.bidones, 2);
  assert.equal(resultados.restoBidones, 48);
  assert.equal(resultados.jarras, 4);
  assert.equal(Number(resultados.horasDecimalChurros.toFixed(3)), 5.184);
  assert.equal(Number(resultados.horasDecimalChocolate.toFixed(1)), 1.4);
  assert.equal(resultados.horas, 5);
  assert.equal(resultados.minutos, 11);
});