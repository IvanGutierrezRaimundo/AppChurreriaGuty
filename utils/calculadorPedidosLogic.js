(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.CalculadorPedidosLogic = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_EQUIV_CONFIG = {
    churrosPorBolsa: 24,
    bolsasPorCaja: 12,
    chocolatesPorBidon: 50,
    vasosPorJarra: 14,
    horasPor1000Churros: 2,
    minutosPorCazo: 40
  };

  function normalizePositiveNumber(value, fallback) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
  }

  function normalizeEquivConfig(config) {
    const source = config || {};
    return {
      churrosPorBolsa: normalizePositiveNumber(source.churrosPorBolsa, DEFAULT_EQUIV_CONFIG.churrosPorBolsa),
      bolsasPorCaja: normalizePositiveNumber(source.bolsasPorCaja, DEFAULT_EQUIV_CONFIG.bolsasPorCaja),
      chocolatesPorBidon: normalizePositiveNumber(source.chocolatesPorBidon, DEFAULT_EQUIV_CONFIG.chocolatesPorBidon),
      vasosPorJarra: normalizePositiveNumber(source.vasosPorJarra, DEFAULT_EQUIV_CONFIG.vasosPorJarra),
      horasPor1000Churros: normalizePositiveNumber(source.horasPor1000Churros, DEFAULT_EQUIV_CONFIG.horasPor1000Churros),
      minutosPorCazo: normalizePositiveNumber(source.minutosPorCazo, DEFAULT_EQUIV_CONFIG.minutosPorCazo)
    };
  }

  function toDurationParts(hoursDecimal) {
    let horas = Math.floor(hoursDecimal);
    let minutos = Math.round((hoursDecimal - horas) * 60);
    if (minutos === 60) {
      minutos = 0;
      horas += 1;
    }
    return { horas, minutos };
  }

  function calculatePedidoResultados(churros, chocolates, config) {
    const normalizedConfig = normalizeEquivConfig(config);
    const totalChurros = Math.max(0, Number(churros) || 0);
    const totalChocolates = Math.max(0, Number(chocolates) || 0);

    const bolsas = totalChurros / normalizedConfig.churrosPorBolsa;
    const cajas = bolsas / normalizedConfig.bolsasPorCaja;
    const bidonesDecimal = totalChocolates / normalizedConfig.chocolatesPorBidon;
    const bidones = Math.floor(bidonesDecimal);
    const restoBidones = totalChocolates % normalizedConfig.chocolatesPorBidon;
    const jarras = restoBidones / normalizedConfig.vasosPorJarra;
    const litrosChocolate = totalChocolates / 7;
    const tuppersChocolatePuro = totalChocolates / 56;
    const cazosNormales = totalChocolates / 100;
    const cazosPuros = totalChocolates / 168;
    const litrosLeche = totalChocolates * 0.036;
    const gramosMezclaCacaoCazoPuro = (totalChocolates / 168) * 5000;
    const gramosMezclaCacaoCazoNormal = cazosNormales * 2500;
    const masas = totalChurros / 1728;
    const masasEnteras = Math.floor(masas);
    const masasDecimalPct = (masas - masasEnteras) * 100;
    const tuppersMasa = totalChurros / 432;
    const tubos = totalChurros / 72;
    const horasDecimalChurros = (totalChurros * normalizedConfig.horasPor1000Churros) / 1000;
    const horasDecimalChocolate = (cazosNormales * normalizedConfig.minutosPorCazo) / 60;
    const horasDecimal = Math.max(horasDecimalChurros, horasDecimalChocolate);
    const duracion = toDurationParts(horasDecimal);

    return {
      config: normalizedConfig,
      churros: totalChurros,
      chocolates: totalChocolates,
      bolsas,
      cajas,
      bidonesDecimal,
      bidones,
      restoBidones,
      jarras,
      litrosChocolate,
      tuppersChocolatePuro,
      cazosNormales,
      cazosPuros,
      litrosLeche,
      gramosMezclaCacaoCazoPuro,
      gramosMezclaCacaoCazoNormal,
      masas,
      masasEnteras,
      masasDecimalPct,
      tuppersMasa,
      tubos,
      horasDecimalChurros,
      horasDecimalChocolate,
      horasDecimal,
      horas: duracion.horas,
      minutos: duracion.minutos
    };
  }

  return {
    DEFAULT_EQUIV_CONFIG,
    normalizeEquivConfig,
    calculatePedidoResultados
  };
});