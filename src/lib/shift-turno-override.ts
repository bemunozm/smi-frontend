import type { Turno } from './turno';
import { safeGet, safeRemove, safeSet } from './local-storage-safe';

const STORAGE_PREFIX = 'smi-shift-register-turno:';

/**
 * Preferencia "adelantar al turno siguiente" del selector de Registro de
 * equipo (ver `hooks/useShiftRegister.ts` y el RFC "Supervisión en Terreno"
 * §Diseño: "Selector de turno actual/siguiente"), persistida POR USUARIO en
 * `localStorage` — mismo patrón que `lib/session-snapshot.ts`.
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

/** Best-effort (ver `lib/local-storage-safe.ts`): si falla, solo significa
 * que la próxima vez el selector vuelve a proponer el turno del reloj. */
export function saveTurnoOverride(userId: string, override: TurnoOverride): void {
  safeSet(`${STORAGE_PREFIX}${userId}`, override);
}

export function readTurnoOverride(userId: string): TurnoOverride | null {
  return safeGet(`${STORAGE_PREFIX}${userId}`, isTurnoOverride);
}

export function clearTurnoOverride(userId: string): void {
  safeRemove(`${STORAGE_PREFIX}${userId}`);
}
