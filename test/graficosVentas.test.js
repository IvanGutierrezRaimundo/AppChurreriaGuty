const test = require('node:test');
const assert = require('node:assert/strict');
const { obtenerTotalesMensuales, obtenerAniosVentas, obtenerResumenAnual } = require('../utils/graficosVentas');

test('obtenerTotalesMensuales suma todas las cajas del año, incluidos los lunes', () => {
  const totales = obtenerTotalesMensuales([
    { fecha: '2025-01-06', caja: 80 },
    { fecha: '2025-01-07', caja: '20.5' },
    { fecha: '2025-02-03', caja: 40 },
    { fecha: '2025-02-04', caja: null },
    { fecha: '2024-01-02', caja: 900 },
    { fecha: '2025-02-30', caja: 30 },
    { fecha: 'fecha-invalida', caja: 25 }
  ], 2025);

  assert.deepEqual(totales, [
    { mes: 1, totalCaja: 100.5, diasConDatos: 2 },
    { mes: 2, totalCaja: 40, diasConDatos: 1 }
  ]);
});

test('obtenerAniosVentas devuelve años existentes sin duplicados y en orden descendente', () => {
  const anios = obtenerAniosVentas([
    { fecha: '2025-01-03', caja: 42.5 },
    { fecha: '2023-01-03', caja: 30 },
    { fecha: '2025-02-03', caja: 50 },
    { fecha: '2026-02-02', caja: 70 },
    { fecha: 'fecha-invalida', caja: 80 }
  ]);

  assert.deepEqual(anios, [2026, 2025, 2023]);
});

test('obtenerResumenAnual calcula la media y ordena los diez días con mayor caja', () => {
  const ventas = Array.from({ length: 12 }, (_valor, indice) => ({
    fecha: `2025-01-${String(indice + 1).padStart(2, '0')}`,
    caja: indice + 1
  }));
  ventas.push(
    { fecha: '2024-12-31', caja: 500 },
    { fecha: '2025-01-20', caja: null },
    { fecha: '2025-01-21', caja: 0 }
  );

  const resumen = obtenerResumenAnual(ventas, 2025);

  assert.equal(resumen.totalCaja, 78);
  assert.equal(resumen.numeroCajas, 13);
  assert.equal(resumen.media, 6);
  assert.deepEqual(resumen.topDiez.map(({ caja }) => caja), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
});