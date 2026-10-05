/**
 * Reglas del AdBlue del cierre de tarjeta. El servidor exige
 * litros > 0 y ≤ 1000 cuando se marcó AdBlue; arriba de 30 L solo se avisa,
 * porque una carga grande existe pero casi siempre es un dedo de más.
 */
export const ADBLUE_MAX_LITROS = 1000;
export const ADBLUE_AVISO_LITROS = 30;

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
    return { litros: null, error: tocado ? 'Indicá cuántos litros de AdBlue cargó.' : null, aviso: null };
  }
  if (litros > ADBLUE_MAX_LITROS) {
    return { litros: null, error: `No puede superar los ${ADBLUE_MAX_LITROS} L.`, aviso: null };
  }
  return {
    litros,
    error: null,
    aviso:
      litros > ADBLUE_AVISO_LITROS
        ? `Son más de ${ADBLUE_AVISO_LITROS} L de AdBlue: revisá que el valor esté bien. Podés guardar igual.`
        : null,
  };
}

/** `true` cuando el AdBlue marcado todavía no tiene un valor que se pueda guardar. */
export function adBlueIncompleto(adBlue: boolean, litros: number | null): boolean {
  return adBlue && (litros == null || litros <= 0 || litros > ADBLUE_MAX_LITROS);
}
