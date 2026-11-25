import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@heroui/react';

import { parseDecimal } from '../lib/decimal';
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
  /** Camioneta: sin operador y con el kilometraje en vez del horómetro. */
  liviano?: boolean;
  /** «Mi camioneta» del supervisor temporal: la apertura va marcada para que
   * el servidor no la sume a su informe. */
  camioneta?: boolean;
}

export interface UseAperturaFormResult {
  apertura: AperturaState;
  setApertura: Dispatch<SetStateAction<AperturaState>>;
  /** `undefined` hasta que el supervisor elige uno: no se preselecciona nada. */
  equipoElegido: Equipment | undefined;
  /** el horómetro tipeado, o el último registrado si el campo está vacío, SIN
   * fallback a `0` — `null` cuando no hay ningún valor válido, así el botón
   * de agregar se deshabilita en vez de abrir una tarjeta con horómetro 0
   * sin que el supervisor lo haya pedido. */
  valorInicialApertura: number | null;
  /** Escribió algo que no es un número: se avisa y no se puede agregar. */
  horometroInvalido: boolean;
  /** El valor es menor que la última lectura del equipo: se avisa, no bloquea
   * (el servidor lo acepta y lo marca). */
  bajoUltimaLectura: boolean;
  abrir: () => void;
  isAbriendo: boolean;
}

/**
 * Formulario de apertura de tarjeta — sub-hook de `useShiftRegister`.
 * `abrir()` SIEMPRE encola vía `enqueueOpenCard` (online
 * u offline, un único camino) — nunca llama a la API directo.
 */
export function useAperturaForm({
  disponibles,
  ctx,
  userId,
  liviano = false,
  camioneta = false,
}: UseAperturaFormParams): UseAperturaFormResult {
  const [apertura, setApertura] = useState<AperturaState>(DEFAULT_APERTURA);
  // Sin preselección: hasta que el supervisor elija, no hay equipo. Precargar el
  // primero de la lista inducía a abrir el equipo equivocado (pedido del
  // cliente, 18/11/2026).
  const equipoElegido = disponibles.find((e) => e.id === apertura.equipoId);
  const lecturaEquipo = liviano ? equipoElegido?.currentMileage : equipoElegido?.currentHourmeter;
  // Vacío conserva la lectura previa del equipo (lo esperado al precargar); un
  // texto que no es un número NO cae en silencio a ella: es un error.
  const textoHorometro = apertura.horometro.trim();
  const horometroInvalido = textoHorometro !== '' && parseDecimal(textoHorometro) == null;
  const valorInicialApertura =
    textoHorometro === '' ? (lecturaEquipo ?? null) : parseDecimal(textoHorometro);
  const ultimaLectura = lecturaEquipo ?? null;
  const bajoUltimaLectura =
    valorInicialApertura != null && ultimaLectura != null && valorInicialApertura < ultimaLectura;

  // Solo cubre el ENCOLADO (rápido, un `put` a Dexie) — la subida y el POST
  // real pasan en segundo plano en el replay. Igual queda la protección
  // anti-doble-toque: mientras el encolado está en vuelo, un segundo toque
  // no hace nada.
  const [isAbriendo, setIsAbriendo] = useState(false);

  const abrir = () => {
    // Sin fallback a `0`: si no hay horómetro tipeado NI último registrado
    // del equipo, no hay ningún valor que mandar — el botón ya queda
    // deshabilitado en la vista con esta misma condición (`valorInicialApertura`).
    if (!equipoElegido || (!liviano && !apertura.operatorId) || valorInicialApertura == null || isAbriendo) return;
    if (!userId) return;
    setIsAbriendo(true);
    void enqueueOpenCard(userId, {
      id: generateUuid(),
      equipoId: equipoElegido.id,
      ...(liviano ? {} : { operatorId: apertura.operatorId }),
      valorInicial: valorInicialApertura,
      shiftDate: toDateOnly(ctx.fecha),
      shiftType: ctx.turno,
      capturedAt: new Date().toISOString(),
      ...(camioneta ? { camioneta: true } : {}),
    })
      .then(() => setApertura((a) => ({ ...a, equipoId: '', horometro: '' })))
      .catch((error: unknown) => {
        toast.danger(error instanceof Error ? error.message : 'No se pudo guardar la apertura en el equipo.');
      })
      .finally(() => setIsAbriendo(false));
  };

  return {
    apertura,
    setApertura,
    equipoElegido,
    valorInicialApertura,
    horometroInvalido,
    bajoUltimaLectura,
    abrir,
    isAbriendo,
  };
}
