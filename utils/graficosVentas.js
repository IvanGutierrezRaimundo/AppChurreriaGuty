const graficosVentas = (() => {
  function normalizarFecha(valor){
    let fecha = valor;
    if(valor instanceof Date && Number.isFinite(valor.getTime())){
      fecha = `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
    } else {
      fecha = String(valor || '').slice(0, 10);
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
    const tiempo = Date.parse(`${fecha}T00:00:00Z`);
    if(!Number.isFinite(tiempo) || new Date(tiempo).toISOString().slice(0, 10) !== fecha) return null;
    return { fecha, tiempo };
  }

  function normalizarCaja(valor){
    if(valor === null || valor === undefined || String(valor).trim() === '') return null;
    const caja = Number(valor);
    return Number.isFinite(caja) ? caja : null;
  }

  function obtenerTotalesMensuales(filas, anioSeleccionado){
    const totalesPorMes = new Map();
    (Array.isArray(filas) ? filas : []).forEach((fila) => {
      const fecha = normalizarFecha(fila.fecha);
      const caja = normalizarCaja(fila.caja);
      if(!fecha || caja === null || Number(fecha.fecha.slice(0, 4)) !== Number(anioSeleccionado)) return;
      const mes = Number(fecha.fecha.slice(5, 7));
      const total = totalesPorMes.get(mes) || { mes, totalCaja: 0, diasConDatos: 0 };
      total.totalCaja += caja;
      total.diasConDatos += 1;
      totalesPorMes.set(mes, total);
    });
    return Array.from(totalesPorMes.values()).sort((a, b) => a.mes - b.mes);
  }

  function obtenerAniosVentas(filas){
    const anios = new Set();
    (Array.isArray(filas) ? filas : []).forEach((fila) => {
      const fecha = normalizarFecha(fila.fecha);
      if(fecha && normalizarCaja(fila.caja) !== null) anios.add(Number(fecha.fecha.slice(0, 4)));
    });
    return Array.from(anios).sort((a, b) => b - a);
  }

  function obtenerResumenAnual(filas, anioSeleccionado){
    const ventasDelAnio = [];
    (Array.isArray(filas) ? filas : []).forEach((fila) => {
      const fecha = normalizarFecha(fila.fecha);
      const caja = normalizarCaja(fila.caja);
      if(!fecha || caja === null || Number(fecha.fecha.slice(0, 4)) !== Number(anioSeleccionado)) return;
      ventasDelAnio.push({ fecha: fecha.fecha, caja });
    });

    const totalCaja = ventasDelAnio.reduce((total, venta) => total + venta.caja, 0);
    const topDiez = [...ventasDelAnio]
      .sort((a, b) => b.caja - a.caja || a.fecha.localeCompare(b.fecha))
      .slice(0, 10);

    return {
      totalCaja,
      numeroCajas: ventasDelAnio.length,
      media: ventasDelAnio.length ? totalCaja / ventasDelAnio.length : 0,
      topDiez
    };
  }

  return { obtenerTotalesMensuales, obtenerAniosVentas, obtenerResumenAnual };
})();

if(typeof module !== 'undefined' && module.exports) module.exports = graficosVentas;
if(typeof window !== 'undefined') window.GraficosVentas = graficosVentas;