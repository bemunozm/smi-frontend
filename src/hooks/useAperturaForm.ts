import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@heroui/react';

import { aNumero } from './shift-register-helpers';
import { enqueueOpenCard } from '../offline/outbox';
import { toDateOnly, type ContextoTurno } from '../lib/turno';
import { generateUuid } from '../lib/uuid';
import type { Equipment } from '../types/equipment';

export interface AperturaState {
  equipoId: string;
  operatorId: string;
  horometro: string;
}

const DEFAULT_APERTURA: AperturaState = { equipoId: '', operatorId: '', horometro: '' };

export interface UseAperturaFormParams {
  disponibles: Equipment[];
  ctx: ContextoTurno;
  userId: string | undefined;
}

export interface UseAperturaFormResult {
  apertura: AperturaState;
  setApertura: Dispatch<SetStateAction<AperturaState>>;
  equipoElegido: Equipment | undefined;
  /** `aNumero(apertura.horometro) ?? equipoElegido?.currentHourmeter`, SIN
   * fallback a `0` — `null` cuando no hay ningún valor válido, así el botón
   * de agregar se deshabilita en vez de abrir una tarjeta con horómetro 0
   * sin que el supervisor lo haya pedido. */
  valorInicialApertura: number | null;
  abrir: () => void;
  isAbriendo: boolean;
}

/**
 * Formulario de apertura de tarjeta — sub-hook de `useShiftRegister`.
 * `abrir()` SIEMPRE encola vía `enqueueOpenCard` (online
 * u offline, un único camino) — nunca llama a la API directo.
 */
export function useAperturaForm({ disponibles, ctx, userId }: UseAperturaFormParams): UseAperturaFormResult {
  const [apertura, setApertura] = useState<AperturaState>(DEFAULT_APERTURA);
  const equipoElegido = disponibles.find((e) => e.id === apertura.equipoId) ?? disponibles[0];
  const valorInicialApertura = aNumero(apertura.horometro) ?? equipoElegido?.currentHourmeter ?? null;

  // Solo cubre el ENCOLADO (rápido, un `put` a Dexie) — la subida y el POST
  // real pasan en segundo plano en el replay. Igual queda la protección
  // anti-doble-toque: mientras el encolado está en vuelo, un segundo toque
  // no hace nada.
  const [isAbriendo, setIsAbriendo] = useState(false);

  const abrir = () => {
    // Sin fallback a `0`: si no hay horómetro tipeado NI último registrado
    // del equipo, no hay ningún valor que mandar — el botón ya queda
    // deshabilitado en la vista con esta misma condición (`valorInicialApertura`).
    if (!equipoElegido || !apertura.operatorId || valorInicialApertura == null || isAbriendo) return;
    if (!userId) return;
    setIsAbriendo(true);
    void enqueueOpenCard(userId, {
      id: generateUuid(),
      equipoId: equipoElegido.id,
      operatorId: apertura.operatorId,
      valorInicial: valorInicialApertura,
      shiftDate: toDateOnly(ctx.fecha),
      shiftType: ctx.turno,
      capturedAt: new Date().toISOString(),
    })
      .then(() => setApertura((a) => ({ ...a, equipoId: '', horometro: '' })))
      .catch((error: unknown) => {
        toast.danger(error instanceof Error ? error.message : 'No se pudo guardar la apertura en el equipo.');
      })
      .finally(() => setIsAbriendo(false));
  };

  return { apertura, setApertura, equipoElegido, valorInicialApertura, abrir, isAbriendo };
}
