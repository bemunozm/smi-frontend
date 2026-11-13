import { useMemo } from 'react';

import { useCurrentUser } from './useCurrentUser';
import { useEquipment } from './useEquipment';
import { useOperators } from './useOperators';
import { useTrabajosExtraList } from './useTrabajosExtra';
import type { CreateTrabajoExtraOp, HttpWriteOp, OutboxOp } from '../offline/db';
import { useOutboxOps } from '../offline/useOutboxOps';
import type { Equipment } from '../types/equipment';
import type { Operator } from '../types/operator';
import type { DetalleActividadRegistro, TrabajoExtraordinario } from '../types/trabajosExtra';

/** Un trabajo del historial: el del servidor, o uno sintético armado desde
 * una operación pendiente del outbox. */
export interface TrabajoExtraProyectado extends TrabajoExtraordinario {
  /** Viene del outbox: el servidor todavía no lo confirmó. */
  sinSincronizar?: boolean;
  /** El servidor lo rechazó por una razón de negocio — espera una acción en
   * la hoja de `SyncStatus` (Reintentar/Descartar). */
  requiereAtencion?: boolean;
  /** Tiene una edición guardada en el equipo que el servidor todavía no confirmó. */
  edicionSinSincronizar?: boolean;
  /** Esa edición espera una acción en `SyncStatus` — no se encadena otra encima. */
  edicionRequiereAtencion?: boolean;
}

/** Mismo redondeo a 2 decimales con el que el servidor calcula `totalHoras`. */
function horasTotales(inicial: number, final: number): number {
  return Math.round((final - inicial) * 100) / 100;
}

function mapOpToTrabajo(op: CreateTrabajoExtraOp, equipos: Equipment[], operadores: Operator[]): TrabajoExtraProyectado {
  const { payload } = op;
  const equipo = equipos.find((e) => e.id === payload.equipoId);
  const operador = operadores.find((o) => o.id === payload.operatorId);
  return {
    id: op.id,
    equipoId: payload.equipoId,
    operatorId: payload.operatorId,
    operador: operador?.name ?? 'Operador',
    faena: payload.faena,
    turno: payload.turno,
    horometroInicial: payload.horometroInicial,
    horometroFinal: payload.horometroFinal,
    totalHoras: horasTotales(payload.horometroInicial, payload.horometroFinal),
    // El resumen se deriva del desglose, igual que lo hará el servidor.
    actividades: [...new Set(payload.detalle.map((f) => f.actividad))],
    detalleActividades: payload.detalle.map((f) => ({
      actividad: f.actividad,
      lugar: f.lugar,
      planta: f.plantas?.length ? f.plantas.join(', ') : null,
      plantas: f.plantas ?? [],
      horas: f.horas,
      descripcion: f.descripcion?.trim() || null,
    })),
    reportNumero: payload.reportNumero,
    otraActividad: payload.otraActividad?.trim() || null,
    descripcion: payload.descripcion,
    observaciones: payload.observaciones?.trim() || null,
    fecha: payload.capturedAt,
    equipo: equipo ? { internalCode: equipo.internalCode } : undefined,
    sinSincronizar: true,
    requiereAtencion: op.status === 'needs_attention',
  };
}

/**
 * Historial de trabajos extra = servidor + operaciones pendientes del
 * outbox, merge por `id` con el servidor ganando (ver `proyectarHallazgos`).
 * Función pura para testearla sin montar React.
 */
export function proyectarTrabajosExtra(
  servidor: TrabajoExtraordinario[],
  ops: OutboxOp[],
  equipos: Equipment[],
  operadores: Operator[],
): TrabajoExtraProyectado[] {
  const idsServidor = new Set(servidor.map((t) => t.id));
  const pendientes = ops
    .filter((op): op is CreateTrabajoExtraOp => op.type === 'createTrabajoExtra' && !idsServidor.has(op.id))
    .map((op) => mapOpToTrabajo(op, equipos, operadores))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const lista: TrabajoExtraProyectado[] = [...pendientes, ...servidor];
  const ediciones = ops.filter(
    (op): op is HttpWriteOp => op.type === 'httpWrite' && op.endpoint === 'trabajoExtra.edit',
  );
  return ediciones.length === 0 ? lista : aplicarEdiciones(lista, ediciones, equipos, operadores);
}

const texto = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const numero = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** El `detalle` de una edición pendiente, si el cuerpo trae uno con forma. */
const filasDetalle = (v: unknown): DetalleActividadRegistro[] | undefined =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every(
    (f) => f != null && typeof f === 'object' && typeof (f as { actividad?: unknown }).actividad === 'string',
  )
    ? // El cuerpo trae `plantas`; lo que se muestra es `planta` (unidas), como lo guarda el servidor.
      (v as DetalleActividadRegistro[]).map((f) => ({
        ...f,
        planta: f.plantas?.length ? f.plantas.join(', ') : (f.planta ?? null),
      }))
    : undefined;

/** Superpone las ediciones pendientes (en orden `seq`: la última gana) sobre los
 * trabajos que ya existen en el servidor. */
function aplicarEdiciones(
  lista: TrabajoExtraProyectado[],
  ediciones: HttpWriteOp[],
  equipos: Equipment[],
  operadores: Operator[],
): TrabajoExtraProyectado[] {
  return lista.map((r) => {
    if (r.sinSincronizar) return r;
    const propias = ediciones.filter((op) => op.params.id === r.id);
    if (propias.length === 0) return r;
    let editado: TrabajoExtraProyectado = { ...r, edicionSinSincronizar: true };
    for (const { body, status } of propias) {
      const equipoId = texto(body.equipoId);
      const equipo = equipoId ? equipos.find((e) => e.id === equipoId) : undefined;
      const operatorId = texto(body.operatorId);
      const horometroInicial = numero(body.horometroInicial) ?? editado.horometroInicial;
      const horometroFinal = numero(body.horometroFinal) ?? editado.horometroFinal;
      const detalle = filasDetalle(body.detalle);
      editado = {
        ...editado,
        equipoId: equipoId ?? editado.equipoId,
        ...(equipoId ? { equipo: equipo ? { internalCode: equipo.internalCode } : undefined } : {}),
        ...(operatorId
          ? { operatorId, operador: operadores.find((o) => o.id === operatorId)?.name ?? editado.operador }
          : {}),
        faena: texto(body.faena) ?? editado.faena,
        turno: texto(body.turno) ?? editado.turno,
        horometroInicial,
        horometroFinal,
        totalHoras: horasTotales(horometroInicial, horometroFinal),
        // El desglose editado reemplaza completo al vigente, y el resumen se
        // deriva de él — espejo de lo que hará el servidor al recibirlo.
        ...(detalle
          ? { detalleActividades: detalle, actividades: [...new Set(detalle.map((f) => f.actividad))] }
          : {}),
        otraActividad: 'otraActividad' in body ? texto(body.otraActividad)?.trim() || null : editado.otraActividad,
        descripcion: texto(body.descripcion) ?? editado.descripcion,
        observaciones: 'observaciones' in body ? texto(body.observaciones)?.trim() || null : editado.observaciones,
        edicionRequiereAtencion: editado.edicionRequiereAtencion || status === 'needs_attention',
      };
    }
    return editado;
  });
}

export function useTrabajosExtraProjection(): { registros: TrabajoExtraProyectado[] } {
  const { data: servidor = [] } = useTrabajosExtraList();
  const { data: equipos = [] } = useEquipment();
  // Mismo catálogo (solo activos) que usa el formulario — y que
  // `usePrepareOffline` precarga.
  const { data: operadores = [] } = useOperators({ isActive: true });
  const { user } = useCurrentUser();
  const ops = useOutboxOps(user?.id);

  const registros = useMemo(
    () => proyectarTrabajosExtra(servidor, ops, equipos, operadores),
    [servidor, ops, equipos, operadores],
  );
  return { registros };
}
