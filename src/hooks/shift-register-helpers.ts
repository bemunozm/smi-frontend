import { fechaCorta, fromDateOnly, toDateOnly, type ContextoTurno } from '../lib/turno';
import type { ShiftCardResponse } from '../types/shift';

/**
 * Tipos y funciones puras de Registro de equipo — separados de
 * `useShiftRegister.ts` para que los sub-hooks (`useShiftProjection`,
 * `useAperturaForm`, `useCierreForm`, `useExitReportState`) los importen sin
 * crear un ciclo con el hook compositor, que a su vez los re-exporta para
 * que `views/RegistroEquipoView.tsx`/`hooks/useShiftRegister.test.tsx` sigan
 * importándolos desde `./useShiftRegister` tal cual.
 */

export type Estado = 'curso' | 'cerrada';

/** Los dos turnos que la pantalla muestra: el que corre y el que lo precede. */
export type Grupo = 'actual' | 'anterior';

export type EstadoReporte = 'sin-enviar' | 'en-cola' | 'requiere-atencion' | 'enviado';

export interface TarjetaTurno {
  id: string;
  equipo: string;
  tipo: string;
  operador: string;
  /** `null` en tarjetas anteriores al catálogo de operadores. */
  operatorId?: string | null;
  inicial: number;
  final?: number;
  litros?: number;
  /** AdBlue cargado al cierre. */
  adBlue?: boolean;
  adBlueLitros?: number;
  grupo: Grupo;
  /** El turno al que pertenece de verdad (`YYYY-MM-DD` + tipo). `grupo` solo
   * distingue «este turno / cualquier otro»: una carga de un turno pasado
   * (el 03-11 registrado el 11-11) cae en 'anterior' y, sin esto, se
   * rotulaba con la fecha del turno inmediatamente anterior. */
  turnoFecha?: string;
  turnoTipo?: string;
  estado: Estado;
  /** Quién abrió la tarjeta — un supervisor ve las suyas, el administrador
   * ve todas (lo decide el backend, ver `ShiftsService.mine`). */
  supervisor: string;
  /** `user.id` de quien la abrió (para «Mi camioneta» del mantenedor). */
  supervisorId?: string;
  cerradaA?: string;
  /** Cuándo se cerró, en ISO: en una carga de turno pasado es el día en que
   * se registró, no el del turno. */
  cerradaIso?: string;
  observaciones?: string;
  /** URL firmada de la foto del surtidor (`ShiftCardResponse.pumpPhotoUrl`)
   * — nunca la key cruda: la firma al leer la hace el backend. */
  pumpPhotoUrl?: string;
  /** Registrada sin señal, o con un cierre sin señal: está en el equipo,
   * todavía no confirmada por el servidor (existe una operación en el
   * outbox para ella, ver `offline/useOutboxOps.ts`). */
  sinSincronizar?: boolean;
  /** Tiene una edición guardada en el equipo que el servidor todavía no
   * confirmó (ver `offline/endpoints/terreno.ts#shiftCard.edit`). */
  edicionSinSincronizar?: boolean;
  /** Una edición suya espera una acción en `SyncStatus` (p. ej. otra persona
   * cambió el mismo dato): no se encadena otra encima. */
  edicionRequiereAtencion?: boolean;
  /** Quedó abierta al terminar el turno anterior (todavía sin definir quién la
   * cierra). Nunca en un liviano: esos quedan abiertos a propósito. */
  arrastrada?: boolean;
  /** Camioneta: se mide en km, va sin operador y la puede cerrar cualquier
   * supervisor, en otro turno (la carga de combustible llega 24 o 48 h después). */
  liviano?: boolean;
  /** Cuándo se abrió, `mié 22/10 08:15` — en un liviano puede ser de hace días. */
  abiertaEl?: string;
  /** La misma hora en ISO, para calcular cuánto lleva en uso. */
  abiertaIso?: string;
  /** Quién la cerró y si fue en el turno que muestra la pantalla. */
  cerradaPor?: string;
  cerradaPorId?: string;
  cerradaEnActual?: boolean;
}

/** Un liviano sin conductor registrado: lo maneja el supervisor. */
export const SIN_CONDUCTOR = 'Sin conductor';

/** `mié 22/10 08:15` — fecha y hora cortas, en hora local. */
export function fechaHoraCorta(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${dia.replace(',', '')} ${hora}`;
}

/** `true` si el (fecha, tipo) de un shift/tarjeta calza con el turno que
 * muestra la pantalla ahora (`ctx`, ver `useTurnoSelector`). Compartida por
 * `mapCardToTarjeta` (abajo) y los sub-hooks de proyección/reporte. */
export function esActual(fechaShift: string, tipoShift: string, ctx: ContextoTurno): boolean {
  return fechaShift === toDateOnly(ctx.fecha) && tipoShift === ctx.turno;
}

/**
 * `DIURNO mié 03-11` — el turno al que pertenece la tarjeta. Usa su propio
 * turno (`turnoFecha`/`turnoTipo`); solo si no lo trae (una tarjeta vieja
 * sin `shift`) cae al rótulo por grupo, que es lo que se mostraba antes.
 */
export function rotuloTurno(t: TarjetaTurno, actual: string, anterior: string): string {
  if (t.turnoFecha && t.turnoTipo) return `${t.turnoTipo} ${fechaCorta(fromDateOnly(t.turnoFecha))}`;
  return t.grupo === 'actual' ? actual : anterior;
}

/**
 * Las tarjetas agrupadas por su turno real, del más reciente al más viejo
 * (en un mismo día, el NOCTURNO va antes que el DIURNO). Las que no traen
 * turno van al grupo de su `grupo`, como antes.
 */
export function agruparPorTurno(
  tarjetas: TarjetaTurno[],
  actual: { tipo: string; fecha: string },
  anterior: { tipo: string; fecha: string },
): { clave: string; tipo: string; fecha: string; ts: TarjetaTurno[] }[] {
  const grupos = new Map<string, { clave: string; tipo: string; fecha: string; ts: TarjetaTurno[] }>();
  for (const t of tarjetas) {
    const ref = t.grupo === 'actual' ? actual : anterior;
    const tipo = t.turnoFecha && t.turnoTipo ? t.turnoTipo : ref.tipo;
    const fecha = t.turnoFecha && t.turnoTipo ? t.turnoFecha : ref.fecha;
    const clave = `${fecha}|${tipo === 'NOCTURNO' ? 1 : 0}`;
    const g = grupos.get(clave) ?? { clave, tipo, fecha, ts: [] };
    g.ts.push(t);
    grupos.set(clave, g);
  }
  return [...grupos.values()].sort((a, b) => (a.clave < b.clave ? 1 : a.clave > b.clave ? -1 : 0));
}

/** El día (`YYYY-MM-DD`, hora local) de una fecha ISO. */
function diaLocal(iso: string): string {
  return toDateOnly(new Date(iso));
}

/**
 * `mié 11-11 13:16` si la tarjeta se registró DESPUÉS de su turno (carga de
 * un turno pasado): así se ve cuándo se cargó y a qué turno pertenece. En
 * una tarjeta normal no hay nada que aclarar → `undefined`. Un NOCTURNO se
 * cierra a la mañana siguiente: eso no cuenta como carga posterior.
 */
export function registradaDespues(t: TarjetaTurno): string | undefined {
  if (!t.cerradaIso || !t.turnoFecha) return undefined;
  const limite = new Date(fromDateOnly(t.turnoFecha));
  limite.setDate(limite.getDate() + (t.turnoTipo === 'NOCTURNO' ? 1 : 0));
  return diaLocal(t.cerradaIso) > toDateOnly(limite) ? fechaHoraCorta(t.cerradaIso) : undefined;
}

function esActualCard(card: ShiftCardResponse, ctx: ContextoTurno): boolean {
  return card.shift != null && esActual(card.shift.date, card.shift.type, ctx);
}

/**
 * Server → view-model de UNA tarjeta. Exportada aparte para poder testear
 * la traducción sola, sin levantar el hook completo (que depende de
 * sesión/equipos/operadores).
 *
 * Simplificación deliberada (igual que la maqueta original, que solo
 * distinguía dos grupos): cualquier tarjeta que no matchee el turno actual
 * cae en 'anterior', incluida una más vieja que el turno inmediatamente
 * anterior. Puede pasar porque `GET /shift-cards/mine` trae TODAS las
 * tarjetas abiertas sin importar su antigüedad (`ShiftsService.mine`) — que
 * es justo el caso "arrastrada" de varios turnos atrás.
 */
export function mapCardToTarjeta(card: ShiftCardResponse, ctx: ContextoTurno): TarjetaTurno {
  const grupo: Grupo = esActualCard(card, ctx) ? 'actual' : 'anterior';
  const estado: Estado = card.closedAt != null ? 'cerrada' : 'curso';
  const liviano = card.equipo.equipmentClass === 'LIGHT';
  return {
    id: card.id,
    equipo: card.equipo.internalCode,
    tipo: card.equipo.type,
    operador: card.operatorName || (liviano ? SIN_CONDUCTOR : 'Operador'),
    operatorId: card.operatorId,
    inicial: card.valorInicial,
    final: card.valorFinal ?? undefined,
    litros: card.fuelLiters ?? undefined,
    adBlue: card.adBlue,
    adBlueLitros: card.adBlueLiters ?? undefined,
    grupo,
    turnoFecha: card.shift?.date,
    turnoTipo: card.shift?.type,
    estado,
    supervisor: card.supervisorName ?? 'Sin identificar',
    supervisorId: card.supervisorId ?? undefined,
    cerradaA: card.closedAt
      ? new Date(card.closedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      : undefined,
    cerradaIso: card.closedAt ?? undefined,
    observaciones: card.observaciones ?? undefined,
    pumpPhotoUrl: card.pumpPhotoUrl ?? undefined,
    // "arrastrada": sigue abierta y no pertenece al turno que corre ahora.
    arrastrada: !liviano && grupo === 'anterior' && estado === 'curso',
    liviano,
    abiertaEl: fechaHoraCorta(card.createdAt),
    abiertaIso: card.createdAt,
    cerradaPor: card.closedByName ?? undefined,
    cerradaPorId: card.closedById ?? undefined,
    cerradaEnActual: card.closedShift != null && esActual(card.closedShift.date, card.closedShift.type, ctx),
  };
}

/** Línea en español por `emailStatus` del reporte. Neutro y honesto: nunca afirma
 * una entrega que el backend no confirmó (`default` cubre un valor futuro
 * que el frontend todavía no conoce, ver `types/shift.ts#EMAIL_STATUSES`). */
export function lineaEstadoCorreo(emailStatus: string): string {
  switch (emailStatus) {
    case 'SENT':
      return 'Aviso y PDF enviados por correo a la administración';
    case 'PENDING':
      return 'Enviando correo…';
    case 'SKIPPED':
      return 'Aviso enviado en el sistema; el correo no está configurado';
    case 'FAILED':
      return 'Aviso enviado en el sistema; el correo falló';
    default:
      return 'Aviso enviado en el sistema.';
  }
}
