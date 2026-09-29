import { toDateOnly, type ContextoTurno } from '../lib/turno';
import type { ShiftCardResponse } from '../types/shift';

/**
 * Tipos y funciones puras de Registro de equipo (Módulo A) — separados de
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
  inicial: number;
  final?: number;
  litros?: number;
  grupo: Grupo;
  estado: Estado;
  /** Quién abrió la tarjeta — un supervisor ve las suyas, el administrador
   * ve todas (lo decide el backend, ver `ShiftsService.mine`). */
  supervisor: string;
  cerradaA?: string;
  observaciones?: string;
  /** URL firmada de la foto del surtidor (`ShiftCardResponse.pumpPhotoUrl`)
   * — nunca la key cruda, ver Diseño del RFC R2-storage. */
  pumpPhotoUrl?: string;
  /** Registrada sin señal, o con un cierre sin señal: está en el equipo,
   * todavía no confirmada por el servidor (existe una operación en el
   * outbox para ella, ver `offline/useOutboxOps.ts`). */
  sinSincronizar?: boolean;
  /** Quedó abierta al terminar el turno anterior — ver la nota Q5 del plan
   * (todavía sin decidir con el cliente quién la cierra). */
  arrastrada?: boolean;
}

/** `"12.487,3"` → `12487.3` — mismo parser de la maqueta original (formato
 * chileno: punto de miles, coma decimal). `null` si el campo está vacío o
 * no es un número. */
export function aNumero(s: string): number | null {
  if (!s.trim()) return null;
  const v = Number.parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(v) ? null : v;
}

/** `true` si el (fecha, tipo) de un shift/tarjeta calza con el turno que
 * muestra la pantalla ahora (`ctx`, ver `useTurnoSelector`). Compartida por
 * `mapCardToTarjeta` (abajo) y los sub-hooks de proyección/reporte. */
export function esActual(fechaShift: string, tipoShift: string, ctx: ContextoTurno): boolean {
  return fechaShift === toDateOnly(ctx.fecha) && tipoShift === ctx.turno;
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
  return {
    id: card.id,
    equipo: card.equipo.internalCode,
    tipo: card.equipo.type,
    operador: card.operatorName,
    inicial: card.valorInicial,
    final: card.valorFinal ?? undefined,
    litros: card.fuelLiters ?? undefined,
    grupo,
    estado,
    supervisor: card.supervisorName ?? 'Sin identificar',
    cerradaA: card.closedAt
      ? new Date(card.closedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      : undefined,
    observaciones: card.observaciones ?? undefined,
    pumpPhotoUrl: card.pumpPhotoUrl ?? undefined,
    // "arrastrada": sigue abierta y no pertenece al turno que corre ahora.
    arrastrada: grupo === 'anterior' && estado === 'curso',
  };
}

/** Línea en español por `emailStatus` del reporte — RFC "Supervisión en
 * Terreno" §Diseño → Offline → Proyección. Neutro y honesto: nunca afirma
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
