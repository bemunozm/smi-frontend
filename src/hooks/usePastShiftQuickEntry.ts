import { useState } from 'react';
import { toast } from '@heroui/react';

import { parseDecimal } from '../lib/decimal';
import { LITROS_FUERA_DE_RANGO, LITROS_MAX } from './useCierreForm';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { toDateOnly, type ContextoTurno } from '../lib/turno';
import { generateUuid } from '../lib/uuid';
import type { OpenCardOp, RegisterClosedCardOp } from '../offline/db';
import { enqueueClosedCard, enqueueClosedCardPair, enqueueExitReport } from '../offline/outbox';
import { useOutboxOps } from '../offline/useOutboxOps';
import type { Equipment } from '../types/equipment';
import type { ShiftSummary, ShiftType } from '../types/shift';

/** Una fila de la planilla: equipo · operador · horómetros · litros · foto.
 * Los números en texto crudo del input; se parsean recién al validar/guardar. */
export interface QuickEntryRow {
  /** Identidad estable de la fila: `setFila` reemplaza el objeto, así que el
   * rastreo de las ya encoladas no puede apoyarse en la referencia. */
  key: string;
  equipoId: string;
  operatorId: string;
  inicial: string;
  final: string;
  litros: string;
  /** Foto del combustible de ESA carga — OBLIGATORIA en toda fila, igual
   * que en el cierre normal (incluso con 0 litros queda evidencia). */
  foto: File | null;
}

const filaVacia = (): QuickEntryRow => ({
  key: generateUuid(),
  equipoId: '',
  operatorId: '',
  inicial: '',
  final: '',
  litros: '',
  foto: null,
});

const esVacia = (f: QuickEntryRow) =>
  !f.equipoId && !f.operatorId && !f.inicial.trim() && !f.final.trim() && !f.litros.trim() && !f.foto;

const SIN_CHECKLISTS_PENDIENTES: ReadonlyMap<string, string> = new Map();

export interface UsePastShiftQuickEntryParams {
  /** El turno pasado elegido — `guardar()` abre y cierra las tarjetas en él. */
  ctx: ContextoTurno;
  /** Pesados elegibles (la proyección ya excluye ocupados y livianos). */
  disponibles: Equipment[];
  userId: string | undefined;
  /** equipoId → motivo por el que su checklist del día no está aceptado. El
   * backend rechaza abrir un equipo así, y la fila fallaría recién al
   * reproducir el outbox: se frena antes de guardar. */
  checklistSinAceptar?: ReadonlyMap<string, string>;
  /** `true` = día de negocio estrictamente ANTERIOR a hoy → cada fila viaja
   * como tarjeta que nace cerrada (`POST /shift-cards/closed`, una sola op).
   * `false` = turno terminado de HOY (p. ej. el DIURNO registrado esa misma
   * noche): `/closed` lo rechazaría (`SHIFT_NOT_FINISHED`), así que va por el
   * par legacy apertura+cierre, con las reglas normales del flujo vivo. */
  esDiaPasado: boolean;
  /** Los turnos ya existentes del día elegido (`usePastShiftSummary`): las
   * tarjetas previas de MI turno entran también al reporte automático, para
   * que el último PDF enviado sea la foto completa del día. */
  turnosRegistrados?: ShiftSummary[];
}

export interface UsePastShiftQuickEntryResult {
  filas: QuickEntryRow[];
  setFila: (i: number, patch: Partial<QuickEntryRow>) => void;
  agregarFila: () => void;
  quitarFila: (i: number) => void;
  /** Elegibles para la fila `i`: `disponibles` menos los tomados por OTRAS filas. */
  equiposDeFila: (i: number) => Equipment[];
  /** Qué le falta o qué está mal en la fila — `null` si está completa o del todo vacía. */
  errorDeFila: (i: number) => string | null;
  /** Al menos una fila completa y ninguna a medias o con error. */
  puedeGuardar: boolean;
  /** Encola apertura + cierre (con su foto) por cada fila, en orden, por el
   * outbox — un único camino online u offline. `true` si todo quedó guardado
   * y la grilla vuelve a una fila vacía; si una fila falla quedan en la grilla
   * solo ella y las pendientes. */
  guardar: () => Promise<boolean>;
  isGuardando: boolean;
}

/**
 * Carga rápida del turno pasado: la planilla de papel (una fila por equipo)
 * convertida en tarjetas abiertas+cerradas de ese turno. Sub-flujo del modo
 * "Registrar turno pasado" de Informe diario equipos. `guardar()` encola
 * también el reporte de salida del día: las tarjetas nacen cerradas, así que
 * el flujo normal del reporte (que cuenta las "en curso") nunca las vería y
 * el día no llegaría al Informe diario equipos del administrador ni a su PDF.
 */
export function usePastShiftQuickEntry({
  ctx,
  disponibles,
  userId,
  checklistSinAceptar = SIN_CHECKLISTS_PENDIENTES,
  esDiaPasado,
  turnosRegistrados,
}: UsePastShiftQuickEntryParams): UsePastShiftQuickEntryResult {
  const [filas, setFilas] = useState<QuickEntryRow[]>(() => [filaVacia()]);
  const [isGuardando, setIsGuardando] = useState(false);
  const ops = useOutboxOps(userId);

  const setFila = (i: number, patch: Partial<QuickEntryRow>) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const agregarFila = () => setFilas((fs) => [...fs, filaVacia()]);
  const quitarFila = (i: number) => setFilas((fs) => (fs.length === 1 ? [filaVacia()] : fs.filter((_, j) => j !== i)));

  const equiposDeFila = (i: number) => {
    const tomados = new Set(filas.filter((_, j) => j !== i).map((f) => f.equipoId));
    return disponibles.filter((e) => !tomados.has(e.id));
  };

  const errorDeFila = (i: number): string | null => {
    const f = filas[i];
    if (!f || esVacia(f)) return null;
    if (!f.equipoId) return 'Elige el equipo.';
    const motivoChecklist = checklistSinAceptar.get(f.equipoId);
    if (motivoChecklist) return `No se puede registrar este equipo: ${motivoChecklist}.`;
    if (!f.operatorId) return 'Elige el operador.';
    const inicial = parseDecimal(f.inicial);
    if (inicial == null) return 'Escribe el horómetro inicial.';
    const final = parseDecimal(f.final);
    if (final == null) return 'Escribe el horómetro final.';
    if (final < inicial) return 'El horómetro final debe ser ≥ al inicial.';
    if (f.litros.trim() !== '' && parseDecimal(f.litros) == null) {
      return 'Litros inválidos (vacío = sin carga).';
    }
    const litros = parseDecimal(f.litros);
    if (litros != null && (litros < 0 || litros > LITROS_MAX)) return LITROS_FUERA_DE_RANGO;
    if (!f.foto) return 'Agrega la foto del combustible de esta carga.';
    return null;
  };

  const completas = filas.filter((f, i) => !esVacia(f) && errorDeFila(i) == null);
  const puedeGuardar = completas.length > 0 && filas.every((f, i) => esVacia(f) || errorDeFila(i) == null);

  const guardar = async (): Promise<boolean> => {
    if (isGuardando || !puedeGuardar) return false;
    if (!userId) {
      toast.danger('No hay una sesión activa. Inicia sesión para guardar el turno.');
      return false;
    }
    setIsGuardando(true);
    const guardadas = new Set<string>();
    try {
      // Día estrictamente pasado → tarjeta que NACE cerrada (una sola op,
      // sin ventana abierta ni dependencia del estado presente del equipo).
      // Turno terminado de HOY → par legacy apertura+cierre (ver el jsdoc de
      // `esDiaPasado`). Ambos guardan la fila con SU foto, atómicos.
      const encolar = esDiaPasado ? enqueueClosedCard : enqueueClosedCardPair;
      const idsEncoladas: string[] = [];
      for (const f of completas) {
        const id = generateUuid();
        const capturedAt = new Date().toISOString();
        await encolar(
          userId,
          {
            id,
            equipoId: f.equipoId,
            operatorId: f.operatorId,
            valorInicial: parseDecimal(f.inicial)!,
            shiftDate: toDateOnly(ctx.fecha),
            shiftType: ctx.turno as ShiftType,
            capturedAt,
          },
          {
            closeClientId: generateUuid(),
            valorFinal: parseDecimal(f.final)!,
            fuelLiters: f.litros.trim() === '' ? 0 : parseDecimal(f.litros)!,
            capturedAt,
          },
          f.foto!,
        );
        guardadas.add(f.key);
        idsEncoladas.push(id);
      }
      // El guardado ES el envío del reporte de salida del día (con su PDF
      // para el Informe diario equipos del administrador) — se encola
      // DESPUÉS de las tarjetas y el outbox lo hace depender de ellas, así
      // el PDF siempre las incluye. Entran también las tarjetas que MI
      // turno ya tenía (`turnosRegistrados`) y las de un guardado anterior
      // aún pendientes en el outbox: cada envío es la foto completa del día
      // (un turno puede tener más de un envío; el último manda).
      const previas = (turnosRegistrados ?? []).find((t) => t.supervisorId === userId)?.cards.map((c) => c.id) ?? [];
      const pendientes = ops
        .filter(
          (op): op is OpenCardOp | RegisterClosedCardOp => op.type === 'openCard' || op.type === 'registerClosedCard',
        )
        .filter((op) => op.payload.shiftDate === toDateOnly(ctx.fecha) && op.payload.shiftType === ctx.turno)
        .map((op) => op.id);
      // `slice(0, 100)`: tope `ArrayMaxSize(100)` de `CreateShiftReportDto`.
      const cardIds = [...new Set([...previas, ...pendientes, ...idsEncoladas])].slice(0, 100);
      await enqueueExitReport(userId, {
        id: generateUuid(),
        shiftDate: toDateOnly(ctx.fecha),
        shiftType: ctx.turno as ShiftType,
        cardIds,
        requestedAt: new Date().toISOString(),
      });
      avisarGuardadoEnCola();
      setFilas([filaVacia()]);
      return true;
    } catch (error: unknown) {
      // Las filas ya guardadas salen de la grilla: reintentar no las duplica.
      if (guardadas.size > 0) {
        setFilas((fs) => {
          const restantes = fs.filter((f) => !guardadas.has(f.key));
          return restantes.length > 0 ? restantes : [filaVacia()];
        });
        avisarGuardadoEnCola();
      }
      toast.danger(error instanceof Error ? error.message : 'No se pudo guardar el turno en el equipo.');
      return false;
    } finally {
      setIsGuardando(false);
    }
  };

  return { filas, setFila, agregarFila, quitarFila, equiposDeFila, errorDeFila, puedeGuardar, guardar, isGuardando };
}
