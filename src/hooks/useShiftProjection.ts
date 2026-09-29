import { useMemo } from 'react';

import { esActual, mapCardToTarjeta, type TarjetaTurno } from './shift-register-helpers';
import type { CloseCardOp, OpenCardOp, OutboxOp } from '../offline/db';
import type { ContextoTurno } from '../lib/turno';
import type { Equipment } from '../types/equipment';
import type { Operator } from '../types/operator';
import type { ShiftCardResponse } from '../types/shift';

/** Apertura pendiente en el outbox → tarjeta sintética 'curso', con
 * `sinSincronizar: true`. Equipo/operador se resuelven contra los catálogos
 * ya cargados (`useEquipment`/`useOperators`) — si todavía no están (ej.
 * arranque en frío sin caché), se muestra un guion en vez de romper. */
function mapOpenOpToTarjeta(
  op: OpenCardOp,
  ctx: ContextoTurno,
  equipos: Equipment[],
  operadores: Operator[],
  supervisor: string,
): TarjetaTurno {
  const equipo = equipos.find((e) => e.id === op.payload.equipoId);
  const operador = operadores.find((o) => o.id === op.payload.operatorId);
  const grupo = esActual(op.payload.shiftDate, op.payload.shiftType, ctx) ? 'actual' : 'anterior';
  return {
    id: op.id,
    equipo: equipo?.internalCode ?? '—',
    tipo: equipo?.type ?? '—',
    operador: operador?.name ?? 'Operador',
    inicial: op.payload.valorInicial,
    grupo,
    estado: 'curso',
    supervisor,
    sinSincronizar: true,
    arrastrada: grupo === 'anterior',
  };
}

/** Superpone un cierre pendiente del outbox sobre la tarjeta base (servidor
 * o una apertura pendiente) — la tarjeta base "gana" en los campos que no
 * cambian (equipo, tipo, operador, supervisor, inicial). */
function overlayCloseOp(base: TarjetaTurno, op: CloseCardOp): TarjetaTurno {
  return {
    ...base,
    estado: 'cerrada',
    final: op.payload.input.valorFinal,
    litros: op.payload.input.fuelLiters,
    observaciones: op.payload.input.observaciones ?? base.observaciones,
    cerradaA: new Date(op.payload.input.capturedAt).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    sinSincronizar: true,
    arrastrada: false,
  };
}

function construirHintEquipo(enTaller: Equipment[], ocupados: Equipment[]): string {
  const partes: string[] = [];
  if (enTaller.length === 1) {
    partes.push(`${enTaller[0]!.internalCode} no aparece porque no está operativo.`);
  } else if (enTaller.length > 1) {
    partes.push(`${enTaller.length} equipos no aparecen porque no están operativos.`);
  }

  if (ocupados.length === 1) {
    const equipo = ocupados[0]!;
    const quien = equipo.openShift?.supervisorName;
    partes.push(`${equipo.internalCode} no aparece porque está ocupado${quien ? ` por ${quien}` : ''}.`);
  } else if (ocupados.length > 1) {
    partes.push(`${ocupados.length} equipos no aparecen porque están ocupados.`);
  }

  return partes.length > 0 ? `Solo equipos operativos y libres. ${partes.join(' ')}` : 'Solo equipos operativos y libres.';
}

export interface UseShiftProjectionParams {
  ctx: ContextoTurno;
  equipos: Equipment[];
  operadores: Operator[];
  tarjetasServidor: ShiftCardResponse[];
  ops: OutboxOp[];
  supervisor: string;
}

export interface UseShiftProjectionResult {
  tarjetas: TarjetaTurno[];
  abiertasActual: TarjetaTurno[];
  abiertasAnterior: TarjetaTurno[];
  cerradas: TarjetaTurno[];
  /** = `abiertasActual` — las que entran en el reporte de salida. */
  enCurso: TarjetaTurno[];
  disponibles: Equipment[];
  enTaller: Equipment[];
  /** Texto único ya armado para el `hint` del selector de equipo — junta
   * "en taller" y "ocupado" en una sola frase. */
  equipoHint: string;
}

/**
 * Proyección offline-first: servidor (`tarjetasServidor`) + outbox
 * (`ops`), merge por id, MÁS los equipos disponibles para abrir una tarjeta
 * nueva (R1: operativos y sin turno abierto). Sub-hook de `useShiftRegister`
 * (Anexo 3, revisión final).
 */
export function useShiftProjection({
  ctx,
  equipos,
  operadores,
  tarjetasServidor,
  ops,
  supervisor,
}: UseShiftProjectionParams): UseShiftProjectionResult {
  const opsAbrir = useMemo(() => ops.filter((op): op is OpenCardOp => op.type === 'openCard'), [ops]);
  const opsCerrar = useMemo(() => ops.filter((op): op is CloseCardOp => op.type === 'closeCard'), [ops]);

  const tarjetas = useMemo(() => {
    const porId = new Map<string, TarjetaTurno>();
    tarjetasServidor.forEach((card) => porId.set(card.id, mapCardToTarjeta(card, ctx)));
    // El servidor gana: una apertura pendiente cuyo id YA tiene tarjeta de
    // servidor es una que el replay ya confirmó pero cuyo `delete` en Dexie
    // todavía no se reflejó en este render — se ignora la sintética.
    opsAbrir.forEach((op) => {
      if (porId.has(op.id)) return;
      porId.set(op.id, mapOpenOpToTarjeta(op, ctx, equipos, operadores, supervisor));
    });
    // Un cierre pendiente se superpone sobre la que ya esté en el mapa
    // (servidor o apertura pendiente) — si no hay base (no debería pasar,
    // el orden FIFO garantiza la apertura antes), se ignora en silencio.
    opsCerrar.forEach((op) => {
      const base = porId.get(op.payload.cardId);
      if (!base) return;
      porId.set(op.payload.cardId, overlayCloseOp(base, op));
    });
    return Array.from(porId.values());
  }, [tarjetasServidor, opsAbrir, opsCerrar, ctx, equipos, operadores, supervisor]);

  const abiertas = tarjetas.filter((t) => t.estado === 'curso');
  const cerradas = tarjetas.filter((t) => t.estado === 'cerrada');
  const abiertasActual = abiertas.filter((t) => t.grupo === 'actual');
  const abiertasAnterior = abiertas.filter((t) => t.grupo === 'anterior');
  const enCurso = abiertasActual;

  // Ids de cierre pendientes, por el id de la tarjeta que cierran — usado
  // para las dos correcciones de `disponibles` de abajo.
  const cierreCardIds = useMemo(() => new Set(opsCerrar.map((op) => op.payload.cardId)), [opsCerrar]);

  /**
   * R1: solo equipos operativos y SIN turno abierto. `e.openShift` (server)
   * sigue siendo la fuente para "ocupado por OTRO supervisor" — `GET
   * /shift-cards/mine` de un SUPERVISOR no trae las tarjetas ajenas, así que
   * un outbox local no podría reconstruir esa señal. Encima:
   * - se excluye el equipo de una apertura MÍA todavía pendiente en el
   *   outbox (el servidor no la conoce todavía, `openShift` seguiría null);
   * - se libera el equipo de una tarjeta MÍA con un cierre pendiente: el
   *   servidor la sigue viendo abierta, pero el orden FIFO del replay
   *   garantiza que ese cierre viaja antes que cualquier apertura nueva.
   */
  const pendingOpenEquipoIds = useMemo(
    () => new Set(opsAbrir.filter((op) => !cierreCardIds.has(op.id)).map((op) => op.payload.equipoId)),
    [opsAbrir, cierreCardIds],
  );
  const pendingClosedEquipoIds = useMemo(() => {
    const ids = new Set<string>();
    tarjetasServidor.forEach((card) => {
      if (card.closedAt == null && cierreCardIds.has(card.id)) ids.add(card.equipoId);
    });
    return ids;
  }, [tarjetasServidor, cierreCardIds]);

  const disponibles = useMemo(
    () =>
      equipos.filter(
        (e) =>
          e.status === 'OPERATIONAL' &&
          (e.openShift == null || pendingClosedEquipoIds.has(e.id)) &&
          !pendingOpenEquipoIds.has(e.id),
      ),
    [equipos, pendingClosedEquipoIds, pendingOpenEquipoIds],
  );
  const enTaller = useMemo(() => equipos.filter((e) => e.status !== 'OPERATIONAL'), [equipos]);

  // Equipos que YA aparecen en mis propias tarjetas abiertas (`tarjetasServidor`
  // — para SUPERVISOR es "mías", para ADMIN es "todas", ver `ShiftsService.
  // mine`). Solo afecta el HINT de "ocupado": decir "CN-007 está ocupado por
  // Supervisor SMI" cuando el que mira la pantalla ES Supervisor SMI es
  // redundante — la tarjeta ya está listada a la derecha. `disponibles` los
  // sigue excluyendo igual (R1 no distingue de quién es el turno abierto).
  const equipoIdsConTarjetaPropiaAbierta = useMemo(
    () => new Set(tarjetasServidor.filter((c) => c.closedAt == null).map((c) => c.equipoId)),
    [tarjetasServidor],
  );
  const ocupados = useMemo(
    () =>
      equipos.filter(
        (e) => e.status === 'OPERATIONAL' && e.openShift != null && !equipoIdsConTarjetaPropiaAbierta.has(e.id),
      ),
    [equipos, equipoIdsConTarjetaPropiaAbierta],
  );
  const equipoHint = useMemo(() => construirHintEquipo(enTaller, ocupados), [enTaller, ocupados]);

  return { tarjetas, abiertasActual, abiertasAnterior, cerradas, enCurso, disponibles, enTaller, equipoHint };
}
