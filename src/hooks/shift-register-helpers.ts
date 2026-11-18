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
  /** `Equipment.id` — para corregir qué máquina salió (editor de cerradas). */
  equipoId: string;
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
  /** Por qué se cerró sin carga de combustible (corte de luz…). */
  motivoSinCarga?: string;
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
  /** Cargas de combustible hechas con la tarjeta todavía abierta (solo
   * livianos), de la más vieja a la más nueva — incluye las que siguen en el
   * equipo. La del cierre NO está acá: sigue en `litros`. */
  cargas?: CargaTarjeta[];
}

/** Una carga intermedia de un liviano (`ShiftCardResponse.fuelLoads`, o una
 * pendiente en la cola). */
export interface CargaTarjeta {
  id: string;
  litros: number;
  /** Kilometraje al cargar. */
  km: number;
  adBlueLitros?: number;
  /** Cuándo se registró, en ISO. */
  fechaIso: string;
  /** Quién la registró. */
  por?: string;
  /** Guardada en el equipo, todavía sin confirmar por el servidor. */
  sinSincronizar?: boolean;
  /** El servidor la rechazó: espera una acción en la hoja de sincronización. */
  requiereAtencion?: boolean;
}

/**
 * Litros de la tarjeta: las cargas intermedias más la del cierre, sin contar
 * dos veces (la del cierre no viaja en `cargas`). Sin cargas intermedias es la
 * del cierre tal cual (`undefined` en una abierta).
 */
export function litrosTotales(t: Pick<TarjetaTurno, 'litros' | 'cargas'>): number | undefined {
  const cargas = t.cargas ?? [];
  if (cargas.length === 0) return t.litros;
  return cargas.reduce((total, c) => total + c.litros, 0) + (t.litros ?? 0);
}

/**
 * El rango de km de las cargas sin cerrar de la tarjeta (incluidas las que
 * siguen en el equipo), o `null` sin cargas. Fija los km intermedios: el
 * inicial no puede quedar por encima del menor ni el final por debajo del
 * mayor (el servidor responde `INITIAL_ABOVE_FUEL_LOAD` / `READING_BELOW_FUEL_LOAD`).
 */
export function kmDeCargas(t: Pick<TarjetaTurno, 'cargas'>): { min: number; max: number } | null {
  const kms = (t.cargas ?? []).map((c) => c.km);
  return kms.length ? { min: Math.min(...kms), max: Math.max(...kms) } : null;
}

/** `45.300 km` — para los mensajes de lectura contra las cargas. */
export function kmTexto(n: number): string {
  return `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`;
}

/** Final menor que el km de una carga de la tarjeta: el mensaje para el campo, o `null`. */
export function errorFinalBajoCarga(t: Pick<TarjetaTurno, 'cargas'>, final: number | null): string | null {
  const rango = kmDeCargas(t);
  if (final == null || !rango || final >= rango.max) return null;
  return `No puede ser menor que el km de una carga registrada en la tarjeta (${kmTexto(rango.max)}).`;
}

/** Inicial mayor que el km de una carga de la tarjeta: el mensaje para el campo, o `null`. */
export function errorInicialSobreCarga(t: Pick<TarjetaTurno, 'cargas'>, inicial: number | null): string | null {
  const rango = kmDeCargas(t);
  if (inicial == null || !rango || inicial <= rango.min) return null;
  return `No puede ser mayor que el km de una carga registrada en la tarjeta (${kmTexto(rango.min)}).`;
}

/** `true` si alguna carga sin cerrar de la tarjeta sigue en el equipo. */
export function tieneCargasSinSincronizar(t: Pick<TarjetaTurno, 'cargas'>): boolean {
  return t.cargas?.some((c) => c.sinSincronizar) ?? false;
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

/**
 * Las tarjetas que abrió `userId` primero; el resto queda en su orden. Para
 * las camionetas abiertas: el supervisor ve arriba la que está usando él
 * (pedido del cliente, 18/11/2026). Sin usuario no reordena nada.
 */
export function primeroLasMias(tarjetas: TarjetaTurno[], userId: string | undefined): TarjetaTurno[] {
  if (!userId) return tarjetas;
  const mias = tarjetas.filter((t) => t.supervisorId === userId);
  return mias.length ? [...mias, ...tarjetas.filter((t) => t.supervisorId !== userId)] : tarjetas;
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
    equipoId: card.equipoId,
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
    motivoSinCarga: card.noFuelReason ?? undefined,
    pumpPhotoUrl: card.pumpPhotoUrl ?? undefined,
    // "arrastrada": sigue abierta y no pertenece al turno que corre ahora.
    arrastrada: !liviano && grupo === 'anterior' && estado === 'curso',
    liviano,
    abiertaEl: fechaHoraCorta(card.createdAt),
    abiertaIso: card.createdAt,
    cerradaPor: card.closedByName ?? undefined,
    cerradaPorId: card.closedById ?? undefined,
    cerradaEnActual: card.closedShift != null && esActual(card.closedShift.date, card.closedShift.type, ctx),
    ...(card.fuelLoads?.length
      ? {
          cargas: card.fuelLoads.map((c) => ({
            id: c.id,
            litros: c.liters,
            km: c.reading,
            adBlueLitros: c.adBlueLiters ?? undefined,
            fechaIso: c.createdAt,
            por: c.createdByName ?? undefined,
          })),
        }
      : {}),
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
