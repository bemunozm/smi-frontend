import { useEffect, useMemo, useState } from 'react';

import { useAhora } from './useAhora';
import { clearTurnoOverride, readTurnoOverride, saveTurnoOverride } from '../lib/shift-turno-override';
import {
  contextoTurno,
  esTurnoPasado,
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
   * reloj (ver `lib/shift-turno-override.ts`); `'pasado'` mientras registra
   * un turno que ya terminó (carga histórica, estado SOLO en memoria). */
  turnoSeleccion: 'reloj' | 'siguiente' | 'pasado';
  /** El turno al que se adelantaría `avanzarTurno()` — para el label del
   * botón. */
  siguienteTurno: Turno;
  avanzarTurno: () => void;
  volverTurnoActual: () => void;
  /** Entra al modo "registrar un turno pasado" con el par elegido. Un par
   * que no es estrictamente anterior al turno vigente se ignora (no-op):
   * el vigente se registra en el modo normal. */
  elegirTurnoPasado: (fecha: Date, turno: Turno) => void;
  /** Si el botón de adelantar turno debe mostrarse — solo dentro de la
   * ventana previa al cambio (`lib/turno.ts#puedeAdelantarTurno`) o
   * mientras el override ya está activo (para poder volver). Fuera de eso
   * un toque accidental cargaría tarjetas en el turno equivocado. */
  mostrarSelectorTurno: boolean;
}

/** ¿El usuario tiene un "adelantar turno" guardado que todavía corresponde al turno del reloj? */
function overrideVigente(userId: string | undefined, clockCtx: ContextoTurno): boolean {
  if (!userId) return false;
  const guardado = readTurnoOverride(userId);
  return !!guardado && guardado.baseTurno === clockCtx.turno && guardado.baseFecha === toDateOnly(clockCtx.fecha);
}

/**
 * Selector de turno "actual / siguiente" de Terreno — sub-hook de
 * `useShiftRegister`; aísla el reloj y `localStorage` para que el resto del
 * hook no dependa de ellos. El turno elegido es uno solo para todo Terreno:
 * las pantallas que solo lo leen usan `useTurnoActual`.
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
  // Se lee ya en el primer render: las demás pantallas de Terreno montan este
  // hook después de que se adelantó el turno en Registro, y no deben pintar un
  // instante el turno del reloj antes de corregirse.
  const [overrideActivo, setOverrideActivo] = useState(() => overrideVigente(userId, clockCtx));
  // Modo "registrar un turno pasado" — SOLO en memoria, nunca localStorage:
  // recargar la página o salir de la vista vuelve al turno del reloj. Es la
  // protección principal contra dejar el modo pegado y cargar las tarjetas
  // de mañana en una fecha vieja.
  const [pasado, setPasado] = useState<{ fecha: Date; turno: Turno } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const vigente = overrideVigente(userId, clockCtx);
    setOverrideActivo(vigente);
    if (!vigente) clearTurnoOverride(userId);
  }, [userId, clockCtx]);

  const siguiente = useMemo(() => turnoSiguiente(clockCtx.turno, clockCtx.fecha), [clockCtx]);
  // Memoizado: sin esto, `ctx` sería un objeto NUEVO en cada render mientras
  // `overrideActivo` es true, y arrastraría a re-computar de más los
  // `useMemo` que dependen de `ctx` en `useShiftProjection`/`useExitReportState`.
  const ctx: ContextoTurno = useMemo(() => {
    // El modo pasado manda sobre el adelanto guardado: mientras dura la
    // carga histórica, el ctx es el turno elegido.
    if (pasado) {
      return {
        turno: pasado.turno,
        fecha: pasado.fecha,
        etiqueta: etiquetaTurno(pasado.turno),
        fechaCorta: fechaCorta(pasado.fecha),
        fechaHora: clockCtx.fechaHora,
      };
    }
    return overrideActivo
      ? {
          turno: siguiente.turno,
          fecha: siguiente.fecha,
          etiqueta: etiquetaTurno(siguiente.turno),
          fechaCorta: fechaCorta(siguiente.fecha),
          fechaHora: clockCtx.fechaHora,
        }
      : clockCtx;
  }, [pasado, overrideActivo, siguiente, clockCtx]);

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
    setPasado(null);
  };
  const elegirTurnoPasado = (fecha: Date, turno: Turno) => {
    if (!esTurnoPasado(fecha, turno, clockCtx)) return;
    setPasado({ fecha, turno });
  };

  const anterior = useMemo(() => turnoAnterior(ctx.turno, ctx.fecha), [ctx]);

  return {
    ctx,
    anterior,
    turnoSeleccion: pasado ? 'pasado' : overrideActivo ? 'siguiente' : 'reloj',
    siguienteTurno: siguiente.turno,
    avanzarTurno,
    volverTurnoActual,
    elegirTurnoPasado,
    mostrarSelectorTurno,
  };
}
