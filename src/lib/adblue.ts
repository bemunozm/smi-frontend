/**
 * Reglas del AdBlue del cierre de tarjeta. El servidor exige litros > 0 y
 * ≤ 1000 cuando se marcó AdBlue; arriba de 30 L (el estanque de los cargadores
 * SEM 3, 4, 5 y 6) solo se avisa, porque otros equipos pueden tener un estanque
 * distinto. El tope de 1000 L es un freno a valores absurdos.
 */
export const ADBLUE_MAX_LITROS = 1000;
export const ADBLUE_ESTANQUE_LITROS = 30;

/** Ayuda bajo el campo de litros mientras el valor no pasa del estanque. */
export const ADBLUE_NOTA_ESTANQUE = `Los cargadores SEM 3, 4, 5 y 6 tienen estanque de ${ADBLUE_ESTANQUE_LITROS} L y gastan cerca de 1 L por hora.`;

export interface ResultadoAdBlue {
  /** Litros ya parseados — `null` cuando no se cargó AdBlue o el valor no sirve. */
  litros: number | null;
  /** Impide guardar. */
  error: string | null;
  /** No impide guardar. */
  aviso: string | null;
}

const SIN_ADBLUE: ResultadoAdBlue = { litros: null, error: null, aviso: null };

/** `litros` ya viene como número: el parseo del formato chileno lo hace el llamador. */
export function validarAdBlue(adBlue: boolean, litros: number | null, tocado: boolean): ResultadoAdBlue {
  if (!adBlue) return SIN_ADBLUE;
  if (litros == null || litros <= 0) {
    return { litros: null, error: tocado ? 'Indicá cuántos litros de AdBlue se cargaron.' : null, aviso: null };
  }
  if (litros > ADBLUE_MAX_LITROS) {
    return { litros: null, error: `No puede superar los ${ADBLUE_MAX_LITROS} L.`, aviso: null };
  }
  return {
    litros,
    error: null,
    aviso:
      litros > ADBLUE_ESTANQUE_LITROS
        ? `Es más de lo que cabe en un estanque de ${ADBLUE_ESTANQUE_LITROS} L: revisá el dato.`
        : null,
  };
}

/** `true` cuando el AdBlue marcado todavía no tiene un valor que se pueda guardar. */
export function adBlueIncompleto(adBlue: boolean, litros: number | null): boolean {
  return adBlue && (litros == null || litros <= 0 || litros > ADBLUE_MAX_LITROS);
}
