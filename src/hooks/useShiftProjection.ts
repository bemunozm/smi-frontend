import { useMemo } from 'react';

import { esActual, fechaHoraCorta, mapCardToTarjeta, SIN_CONDUCTOR, type TarjetaTurno } from './shift-register-helpers';
import type { CloseCardOp, HttpWriteOp, OpenCardOp, OutboxOp } from '../offline/db';
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
  const liviano = equipo?.equipmentClass === 'LIGHT';
  return {
    id: op.id,
    equipo: equipo?.internalCode ?? '—',
    tipo: equipo?.type ?? '—',
    operador: operador?.name ?? (op.payload.operatorId ? 'Operador' : SIN_CONDUCTOR),
    operatorId: op.payload.operatorId ?? null,
    inicial: op.payload.valorInicial,
    adBlue: false,
    grupo,
    estado: 'curso',
    supervisor,
    supervisorId: op.userId,
    sinSincronizar: true,
    arrastrada: !liviano && grupo === 'anterior',
    liviano,
    abiertaEl: fechaHoraCorta(op.payload.capturedAt),
    abiertaIso: op.payload.capturedAt,
  };
}

/** Superpone un cierre pendiente del outbox sobre la tarjeta base (servidor
 * o una apertura pendiente) — la tarjeta base "gana" en los campos que no
 * cambian (equipo, tipo, operador, supervisor, inicial). */
function overlayCloseOp(
  base: TarjetaTurno,
  op: CloseCardOp,
  ctx: ContextoTurno,
  supervisor: string,
  userId: string | undefined,
): TarjetaTurno {
  const { shiftDate, shiftType } = op.payload.input;
  return {
    ...base,
    estado: 'cerrada',
    final: op.payload.input.valorFinal,
    litros: op.payload.input.fuelLiters,
    adBlue: op.payload.input.adBlue ?? false,
    adBlueLitros: op.payload.input.adBlueLiters,
    observaciones: op.payload.input.observaciones ?? base.observaciones,
    cerradaA: new Date(op.payload.input.capturedAt).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    sinSincronizar: true,
    arrastrada: false,
    cerradaPor: supervisor,
    cerradaPorId: userId,
    cerradaEnActual: shiftDate != null && shiftType != null && esActual(shiftDate, shiftType, ctx),
  };
}

const numero = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** Superpone una edición pendiente (`PATCH /shift-cards/:id` en el outbox) sobre
 * la tarjeta: lo que se ve ya es lo que quedará cuando el servidor lo confirme.
 * Las ediciones llegan en orden `seq`, así la última gana. */
function overlayEditOp(base: TarjetaTurno, op: HttpWriteOp, operadores: Operator[]): TarjetaTurno {
  const { body } = op;
  const operatorId = typeof body.operatorId === 'string' ? body.operatorId : undefined;
  const adBlue = typeof body.adBlue === 'boolean' ? body.adBlue : (base.adBlue ?? false);
  return {
    ...base,
    ...(operatorId
      ? { operatorId, operador: operadores.find((o) => o.id === operatorId)?.name ?? base.operador }
      : {}),
    inicial: numero(body.valorInicial) ?? base.inicial,
    final: numero(body.valorFinal) ?? base.final,
    litros: numero(body.fuelLiters) ?? base.litros,
    adBlue,
    // `adBlue: false` sin litros los borra en el servidor.
    adBlueLitros: !adBlue ? undefined : (numero(body.adBlueLiters) ?? base.adBlueLitros),
    observaciones: typeof body.observaciones === 'string' ? body.observaciones || undefined : base.observaciones,
    edicionSinSincronizar: true,
    edicionRequiereAtencion: base.edicionRequiereAtencion || op.status === 'needs_attention',
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
  userId: string | undefined;
}

export interface UseShiftProjectionResult {
  tarjetas: TarjetaTurno[];
  abiertasActual: TarjetaTurno[];
  abiertasAnterior: TarjetaTurno[];
  cerradas: TarjetaTurno[];
  /** `abiertasActual` más los livianos que YO cerré en este turno — las que
   * entran en el reporte de salida. */
  enCurso: TarjetaTurno[];
  /** Livianos: van aparte, abiertos sin importar el turno (se cierran cuando
   * se carga combustible, a veces 24 o 48 h después y por otro supervisor). */
  livianosAbiertos: TarjetaTurno[];
  livianosCerrados: TarjetaTurno[];
  /** Pesados operativos y libres. */
  disponibles: Equipment[];
  /** Livianos operativos y libres. */
  disponiblesLivianos: Equipment[];
  enTaller: Equipment[];
  /** Texto único ya armado para el `hint` del selector de equipo — junta
   * "en taller" y "ocupado" en una sola frase. */
  equipoHint: string;
}

/**
 * Proyección offline-first: servidor (`tarjetasServidor`) + outbox
 * (`ops`), merge por id, MÁS los equipos disponibles para abrir una tarjeta
 * nueva (operativos y sin turno abierto). Sub-hook de `useShiftRegister`.
 */
export function useShiftProjection({
  ctx,
  equipos,
  operadores,
  tarjetasServidor,
  ops,
  supervisor,
  userId,
}: UseShiftProjectionParams): UseShiftProjectionResult {
  const opsAbrir = useMemo(() => ops.filter((op): op is OpenCardOp => op.type === 'openCard'), [ops]);
  const opsCerrar = useMemo(() => ops.filter((op): op is CloseCardOp => op.type === 'closeCard'), [ops]);

  const opsEditar = useMemo(
    () => ops.filter((op): op is HttpWriteOp => op.type === 'httpWrite' && op.endpoint === 'shiftCard.edit'),
    [ops],
  );

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
      porId.set(op.payload.cardId, overlayCloseOp(base, op, ctx, supervisor, userId));
    });
    opsEditar.forEach((op) => {
      const id = op.params.id;
      const base = id ? porId.get(id) : undefined;
      if (id && base) porId.set(id, overlayEditOp(base, op, operadores));
    });
    return Array.from(porId.values());
  }, [tarjetasServidor, opsAbrir, opsCerrar, opsEditar, ctx, equipos, operadores, supervisor, userId]);

  const pesadas = tarjetas.filter((t) => !t.liviano);
  const abiertas = pesadas.filter((t) => t.estado === 'curso');
  const cerradas = pesadas.filter((t) => t.estado === 'cerrada');
  const abiertasActual = abiertas.filter((t) => t.grupo === 'actual');
  const abiertasAnterior = abiertas.filter((t) => t.grupo === 'anterior');
  const livianosAbiertos = tarjetas.filter((t) => t.liviano && t.estado === 'curso');
  const livianosCerrados = tarjetas.filter((t) => t.liviano && t.estado === 'cerrada');
  // Un liviano entra en el reporte del turno en que se CIERRA, y solo en el
  // de quien lo cerró (el servidor busca por `closedShiftId`).
  const enCurso = [
    ...abiertasActual,
    ...livianosCerrados.filter((t) => t.cerradaEnActual && t.cerradaPorId != null && t.cerradaPorId === userId),
  ];

  // Ids de cierre pendientes, por el id de la tarjeta que cierran — usado
  // para las dos correcciones de `disponibles` de abajo.
  const cierreCardIds = useMemo(() => new Set(opsCerrar.map((op) => op.payload.cardId)), [opsCerrar]);

  /**
   * Solo equipos operativos y SIN turno abierto. `e.openShift` (server)
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

  const libres = useMemo(
    () =>
      equipos.filter(
        (e) =>
          e.status === 'OPERATIONAL' &&
          (e.openShift == null || pendingClosedEquipoIds.has(e.id)) &&
          !pendingOpenEquipoIds.has(e.id),
      ),
    [equipos, pendingClosedEquipoIds, pendingOpenEquipoIds],
  );
  const disponibles = useMemo(() => libres.filter((e) => e.equipmentClass !== 'LIGHT'), [libres]);
  const disponiblesLivianos = useMemo(() => libres.filter((e) => e.equipmentClass === 'LIGHT'), [libres]);
  const enTaller = useMemo(
    () => equipos.filter((e) => e.status !== 'OPERATIONAL' && e.equipmentClass !== 'LIGHT'),
    [equipos],
  );

  // Equipos que YA aparecen en mis propias tarjetas abiertas (`tarjetasServidor`
  // — para SUPERVISOR es "mías", para ADMIN es "todas", ver `ShiftsService.
  // mine`). Solo afecta el HINT de "ocupado": decir "CN-007 está ocupado por
  // Supervisor SMI" cuando el que mira la pantalla ES Supervisor SMI es
  // redundante — la tarjeta ya está listada a la derecha. `disponibles` los
  // sigue excluyendo igual (la regla no distingue de quién es el turno abierto).
  const equipoIdsConTarjetaPropiaAbierta = useMemo(
    () => new Set(tarjetasServidor.filter((c) => c.closedAt == null).map((c) => c.equipoId)),
    [tarjetasServidor],
  );
  const ocupados = useMemo(
    () =>
      equipos.filter(
        (e) =>
          e.equipmentClass !== 'LIGHT' &&
          e.status === 'OPERATIONAL' &&
          e.openShift != null &&
          !equipoIdsConTarjetaPropiaAbierta.has(e.id),
      ),
    [equipos, equipoIdsConTarjetaPropiaAbierta],
  );
  const equipoHint = useMemo(() => construirHintEquipo(enTaller, ocupados), [enTaller, ocupados]);

  return {
    tarjetas,
    abiertasActual,
    abiertasAnterior,
    cerradas,
    enCurso,
    livianosAbiertos,
    livianosCerrados,
    disponibles,
    disponiblesLivianos,
    enTaller,
    equipoHint,
  };
}
