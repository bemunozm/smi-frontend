import { useState } from 'react';
import { toast } from '@heroui/react';

import { parseDecimal } from '../lib/decimal';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { toDateOnly, type ContextoTurno } from '../lib/turno';
import { generateUuid } from '../lib/uuid';
import { enqueueCloseCard, enqueueOpenCard } from '../offline/outbox';
import type { Equipment } from '../types/equipment';
import type { ShiftType } from '../types/shift';

/** Una fila de la planilla: equipo · operador · horómetros · litros · foto.
 * Los números en texto crudo del input; se parsean recién al validar/guardar. */
export interface QuickEntryRow {
  equipoId: string;
  operatorId: string;
  inicial: string;
  final: string;
  litros: string;
  /** Foto del combustible de ESA carga — OBLIGATORIA en toda fila, igual
   * que en el cierre normal (incluso con 0 litros queda evidencia). */
  foto: File | null;
}

const FILA_VACIA: QuickEntryRow = {
  equipoId: '',
  operatorId: '',
  inicial: '',
  final: '',
  litros: '',
  foto: null,
};

const esVacia = (f: QuickEntryRow) =>
  !f.equipoId && !f.operatorId && !f.inicial.trim() && !f.final.trim() && !f.litros.trim() && !f.foto;

export interface UsePastShiftQuickEntryParams {
  /** El turno pasado elegido — `guardar()` abre y cierra las tarjetas en él. */
  ctx: ContextoTurno;
  /** Pesados elegibles (la proyección ya excluye ocupados y livianos). */
  disponibles: Equipment[];
  userId: string | undefined;
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
  /** Encola apertura + cierre (SIN foto: carga histórica) por cada fila, en
   * orden, por el outbox — un único camino online u offline. `true` si todo
   * quedó guardado; las filas vuelven a una vacía. */
  guardar: () => Promise<boolean>;
  isGuardando: boolean;
}

/**
 * Carga rápida del turno pasado: la planilla de papel (una fila por equipo)
 * convertida en tarjetas abiertas+cerradas de ese turno. Sub-flujo del modo
 * "Registrar turno pasado" de Informe diario equipos.
 */
export function usePastShiftQuickEntry({
  ctx,
  disponibles,
  userId,
}: UsePastShiftQuickEntryParams): UsePastShiftQuickEntryResult {
  const [filas, setFilas] = useState<QuickEntryRow[]>([FILA_VACIA]);
  const [isGuardando, setIsGuardando] = useState(false);

  const setFila = (i: number, patch: Partial<QuickEntryRow>) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const agregarFila = () => setFilas((fs) => [...fs, FILA_VACIA]);
  const quitarFila = (i: number) =>
    setFilas((fs) => (fs.length === 1 ? [FILA_VACIA] : fs.filter((_, j) => j !== i)));

  const equiposDeFila = (i: number) => {
    const tomados = new Set(filas.filter((_, j) => j !== i).map((f) => f.equipoId));
    return disponibles.filter((e) => !tomados.has(e.id));
  };

  const errorDeFila = (i: number): string | null => {
    const f = filas[i];
    if (!f || esVacia(f)) return null;
    if (!f.equipoId) return 'Elige el equipo.';
    if (!f.operatorId) return 'Elige el operador.';
    const inicial = parseDecimal(f.inicial);
    if (inicial == null) return 'Escribe el horómetro inicial.';
    const final = parseDecimal(f.final);
    if (final == null) return 'Escribe el horómetro final.';
    if (final < inicial) return 'El horómetro final debe ser ≥ al inicial.';
    if (f.litros.trim() !== '' && parseDecimal(f.litros) == null) {
      return 'Litros inválidos (vacío = sin carga).';
    }
    if (!f.foto) return 'Agrega la foto del combustible de esta carga.';
    return null;
  };

  const completas = filas.filter((f, i) => !esVacia(f) && errorDeFila(i) == null);
  const puedeGuardar =
    completas.length > 0 && filas.every((f, i) => esVacia(f) || errorDeFila(i) == null);

  const guardar = async (): Promise<boolean> => {
    if (isGuardando || !puedeGuardar) return false;
    if (!userId) {
      toast.danger('No hay una sesión activa. Inicia sesión para guardar el turno.');
      return false;
    }
    setIsGuardando(true);
    try {
      for (const f of completas) {
        const id = generateUuid();
        const capturedAt = new Date().toISOString();
        await enqueueOpenCard(userId, {
          id,
          equipoId: f.equipoId,
          operatorId: f.operatorId,
          valorInicial: parseDecimal(f.inicial)!,
          shiftDate: toDateOnly(ctx.fecha),
          shiftType: ctx.turno as ShiftType,
          capturedAt,
        });
        // Cada cierre viaja con SU foto (obligatoria — la validación de la
        // fila no deja llegar acá sin ella), por el pipeline normal del
        // outbox: se sube y se reclama igual que un cierre vivo.
        await enqueueCloseCard(
          userId,
          id,
          {
            closeClientId: generateUuid(),
            valorFinal: parseDecimal(f.final)!,
            fuelLiters: f.litros.trim() === '' ? 0 : parseDecimal(f.litros)!,
            capturedAt,
          },
          f.foto!,
        );
      }
      avisarGuardadoEnCola();
      setFilas([FILA_VACIA]);
      return true;
    } catch (error: unknown) {
      toast.danger(
        error instanceof Error ? error.message : 'No se pudo guardar el turno en el equipo.',
      );
      return false;
    } finally {
      setIsGuardando(false);
    }
  };

  return {
    filas,
    setFila,
    agregarFila,
    quitarFila,
    equiposDeFila,
    errorDeFila,
    puedeGuardar,
    guardar,
    isGuardando,
  };
}
