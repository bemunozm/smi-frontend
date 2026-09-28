import type { Turno } from './turno';

const STORAGE_PREFIX = 'smi-shift-register-turno:';

/**
 * Preferencia "adelantar al turno siguiente" del selector de Registro de
 * equipo (ver `hooks/useShiftRegister.ts` y el plan "Supervisión en
 * Terreno" §Diseño: "Selector de turno actual/siguiente"), persistida POR
 * USUARIO en `localStorage` — mismo patrón que `lib/session-snapshot.ts`.
 *
 * Solo guarda el (turno, fecha) NATURAL del reloj en el momento en que el
 * supervisor pidió adelantarse — nunca el turno "siguiente" en sí. Así,
 * cuando el reloj avanza más allá de ese par (`useShiftRegister` lo
 * compara en cada render), el override queda obsoleto solo y se ignora: no
 * hay que acordarse de "apagarlo" a mano ni arrastrar un adelanto de ayer
 * al turno de hoy.
 */
export interface TurnoOverride {
  baseTurno: Turno;
  /** `YYYY-MM-DD`, partes locales — ver `lib/turno.ts#toDateOnly`. */
  baseFecha: string;
}

function isTurnoOverride(value: unknown): value is TurnoOverride {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.baseTurno === 'DIURNO' || candidate.baseTurno === 'NOCTURNO') &&
    typeof candidate.baseFecha === 'string'
  );
}

/** Best-effort, igual que `session-snapshot.ts`: `localStorage` puede fallar
 * (cuota, navegación privada) sin que eso bloquee la pantalla — solo
 * significa que la próxima vez el selector vuelve a proponer el turno del
 * reloj. */
export function saveTurnoOverride(userId: string, override: TurnoOverride): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(override));
  } catch (error) {
    console.error('No se pudo guardar la preferencia de turno:', error);
  }
}

export function readTurnoOverride(userId: string): TurnoOverride | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTurnoOverride(parsed) ? parsed : null;
  } catch (error) {
    console.error('No se pudo leer la preferencia de turno:', error);
    return null;
  }
}

export function clearTurnoOverride(userId: string): void {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch (error) {
    console.error('No se pudo limpiar la preferencia de turno:', error);
  }
}
