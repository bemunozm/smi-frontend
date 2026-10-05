import { useCurrentUser } from './useCurrentUser';
import { useTurnoSelector } from './useTurnoSelector';
import type { ContextoTurno } from '../lib/turno';

/**
 * El turno vigente de Terreno para las pantallas que solo lo leen (Hallazgos,
 * Trabajos extra, Reporte diario): el del reloj, o el siguiente si el supervisor
 * se adelantó en Registro de equipo. Sale de `useTurnoSelector`, la misma fuente
 * que Registro, para que las cuatro pantallas muestren siempre el mismo turno.
 */
export function useTurnoActual(): ContextoTurno {
  const { user } = useCurrentUser();
  return useTurnoSelector(user?.id).ctx;
}
