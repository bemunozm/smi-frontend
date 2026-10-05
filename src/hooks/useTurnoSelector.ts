import { useEffect, useMemo, useState } from 'react';

import { useAhora } from './useAhora';
import { clearTurnoOverride, readTurnoOverride, saveTurnoOverride } from '../lib/shift-turno-override';
import {
  contextoTurno,
  etiquetaTurno,
  fechaCorta,
  puedeAdelantarTurno,
  toDateOnly,
  turnoAnterior,
  turnoSiguiente,
  type ContextoTurno,
  type Turno,
} from '../lib/turno';

export interface UseTurnoSelectorResult {
  ctx: ContextoTurno;
  anterior: { turno: Turno; fecha: Date };
  /** `'siguiente'` cuando el supervisor se adelantó un turno respecto del
   * reloj (ver `lib/shift-turno-override.ts`). */
  turnoSeleccion: 'reloj' | 'siguiente';
  /** El turno al que se adelantaría `avanzarTurno()` — para el label del
   * botón. */
  siguienteTurno: Turno;
  avanzarTurno: () => void;
  volverTurnoActual: () => void;
  /** Si el botón de adelantar turno debe mostrarse — solo dentro de la
   * ventana previa al cambio (`lib/turno.ts#puedeAdelantarTurno`) o
   * mientras el override ya está activo (para poder volver). Fuera de eso
   * un toque accidental cargaría tarjetas en el turno equivocado. */
  mostrarSelectorTurno: boolean;
}

/**
 * Selector de turno "actual / siguiente" de Registro de equipo — sub-hook de
 * `useShiftRegister`; aísla el
 * reloj y `localStorage` para que el resto del hook no dependa de ellos.
 */
export function useTurnoSelector(userId: string | undefined): UseTurnoSelectorResult {
  // El turno sale del reloj, no de un valor escrito en la pantalla — ver
  // `lib/turno.ts`.
  const ahora = useAhora();
  const clockCtx = useMemo(() => contextoTurno(ahora), [ahora]);

  // El override solo se guarda como el (turno, fecha) NATURAL del reloj en
  // el momento en que se pidió adelantar, así que queda obsoleto solo en
  // cuanto el reloj avanza más allá de ese par — no hay override "de ayer"
  // que se arrastre al turno de hoy.
  const [overrideActivo, setOverrideActivo] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const guardado = readTurnoOverride(userId);
    const vigente =
      !!guardado && guardado.baseTurno === clockCtx.turno && guardado.baseFecha === toDateOnly(clockCtx.fecha);
    setOverrideActivo(vigente);
    if (guardado && !vigente) clearTurnoOverride(userId);
  }, [userId, clockCtx]);

  const siguiente = useMemo(() => turnoSiguiente(clockCtx.turno, clockCtx.fecha), [clockCtx]);
  // Memoizado: sin esto, `ctx` sería un objeto NUEVO en cada render mientras
  // `overrideActivo` es true, y arrastraría a re-computar de más los
  // `useMemo` que dependen de `ctx` en `useShiftProjection`/`useExitReportState`.
  const ctx: ContextoTurno = useMemo(
    () =>
      overrideActivo
        ? {
            turno: siguiente.turno,
            fecha: siguiente.fecha,
            etiqueta: etiquetaTurno(siguiente.turno),
            fechaCorta: fechaCorta(siguiente.fecha),
            fechaHora: clockCtx.fechaHora,
          }
        : clockCtx,
    [overrideActivo, siguiente, clockCtx],
  );

  // Botón "adelantar turno": solo dentro de la ventana previa al cambio, o
  // si el override ya está activo (para poder volver) — un toque accidental
  // fuera de esa ventana no tiene ninguna razón real detrás y solo arriesga
  // cargar tarjetas en el turno equivocado.
  const mostrarSelectorTurno = puedeAdelantarTurno(ahora) || overrideActivo;

  const avanzarTurno = () => {
    if (!userId) return;
    saveTurnoOverride(userId, { baseTurno: clockCtx.turno, baseFecha: toDateOnly(clockCtx.fecha) });
    setOverrideActivo(true);
  };
  const volverTurnoActual = () => {
    if (userId) clearTurnoOverride(userId);
    setOverrideActivo(false);
  };

  const anterior = useMemo(() => turnoAnterior(ctx.turno, ctx.fecha), [ctx]);

  return {
    ctx,
    anterior,
    turnoSeleccion: overrideActivo ? 'siguiente' : 'reloj',
    siguienteTurno: siguiente.turno,
    avanzarTurno,
    volverTurnoActual,
    mostrarSelectorTurno,
  };
}
