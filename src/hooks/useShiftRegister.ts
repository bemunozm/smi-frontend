import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { toast } from '@heroui/react';

import { useAhora } from './useAhora';
import { useCurrentUser } from './useCurrentUser';
import { useEquipment } from './useEquipment';
import { useOperators } from './useOperators';
import { useShiftCardsMine } from './useShiftCards';
import { ShiftReportAPI } from '../api/ShiftReportAPI';
import type { CloseCardOp, OpenCardOp, OutboxLastError, SendExitReportOp } from '../offline/db';
import { enqueueCloseCard, enqueueExitReport, enqueueOpenCard } from '../offline/outbox';
import { useOutboxOps } from '../offline/useOutboxOps';
import { clearTurnoOverride, readTurnoOverride, saveTurnoOverride } from '../lib/shift-turno-override';
import {
  contextoTurno,
  etiquetaTurno,
  fechaCorta,
  puedeAdelantarTurno,
  toDateOnly,
  turnoAnterior,
  turnoSiguiente,
  type ContextoTurno,
  type Turno,
} from '../lib/turno';
import { generateUuid } from '../lib/uuid';
import { usePhotoCaptureFlow, type UsePhotoCaptureFlowResult } from '../lib/usePhotoCaptureFlow';
import type { Equipment } from '../types/equipment';
import type { Operator } from '../types/operator';
import { ROLES } from '../types/roles';
import type { ShiftCardExitReport, ShiftCardResponse } from '../types/shift';

/**
 * Adaptador de datos de Registro de equipo (Módulo A) — RFC "Supervisión en
 * Terreno" §Diseño ("Pantalla: `useShiftRegister()` devuelve el mismo
 * view-model que la maqueta"). `views/RegistroEquipoView.tsx` (de Joaquín)
 * consume ESTE shape tal cual — el JSX no se tocó, salvo el panel de
 * reporte de salida (Fase 5: pasa de UI-only a conectado, ver más abajo).
 *
 * FASE 5 (offline): esta capa ahora es "offline-first" — proyecta el
 * servidor (`useShiftCardsMine`) MÁS las operaciones pendientes del outbox
 * (`useOutboxOps`, Dexie `liveQuery`) en el MISMO view-model, y `abrir()`/
 * `cerrar()`/`enviarReporte()` encolan en vez de llamar a la API directo —
 * un único camino, online u offline (ver `offline/outbox.ts`,
 * `offline/replay.ts`).
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

export interface AperturaState {
  equipoId: string;
  operatorId: string;
  horometro: string;
}

export interface CierreState {
  final: string;
  litros: string;
  observaciones: string;
}

/** `"12.487,3"` → `12487.3` — mismo parser de la maqueta original (formato
 * chileno: punto de miles, coma decimal). `null` si el campo está vacío o
 * no es un número. */
export function aNumero(s: string): number | null {
  if (!s.trim()) return null;
  const v = Number.parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(v) ? null : v;
}

function esActual(fechaShift: string, tipoShift: string, ctx: ContextoTurno): boolean {
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
  const grupo: Grupo = esActual(op.payload.shiftDate, op.payload.shiftType, ctx) ? 'actual' : 'anterior';
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

const DEFAULT_APERTURA: AperturaState = { equipoId: '', operatorId: '', horometro: '' };
const DEFAULT_CIERRE: CierreState = { final: '', litros: '', observaciones: '' };

export interface UseShiftRegisterResult {
  ctx: ContextoTurno;
  anterior: { turno: Turno; fecha: Date };
  /** `'siguiente'` cuando el supervisor se adelantó un turno respecto del
   * reloj (ver `lib/shift-turno-override.ts`). */
  turnoSeleccion: 'reloj' | 'siguiente';
  /** El turno al que se adelantaría `avanzarTurno()` — para el label del
   * botón. */
  siguienteTurno: Turno;
  avanzarTurno: () => void;
  volverTurnoActual: () => void;
  /** Si el botón de adelantar turno debe mostrarse — solo dentro de la
   * ventana previa al cambio (`lib/turno.ts#puedeAdelantarTurno`) o
   * mientras el override ya está activo (para poder volver). Fuera de eso
   * un toque accidental cargaría tarjetas en el turno equivocado. */
  mostrarSelectorTurno: boolean;

  supervisor: string;
  veTodo: boolean;

  disponibles: Equipment[];
  enTaller: Equipment[];
  /** Texto único ya armado para el `hint` del selector de equipo — junta
   * "en taller" y "ocupado" en una sola frase. */
  equipoHint: string;

  operadores: Operator[];

  abiertasActual: TarjetaTurno[];
  abiertasAnterior: TarjetaTurno[];
  cerradas: TarjetaTurno[];
  /** = `abiertasActual` — las que entran en el reporte de salida. */
  enCurso: TarjetaTurno[];
  isLoadingTarjetas: boolean;

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

  cerrandoId: string | null;
  setCerrandoId: Dispatch<SetStateAction<string | null>>;
  cerrando: TarjetaTurno | null;
  cierre: CierreState;
  setCierre: Dispatch<SetStateAction<CierreState>>;
  abrirCierre: (id: string) => void;
  cerrar: () => Promise<void>;
  finalNum: number | null;
  horasMaquina: number | null;
  finalInvalido: boolean;
  isCerrando: boolean;
  foto: UsePhotoCaptureFlowResult;

  verReporte: boolean;
  setVerReporte: Dispatch<SetStateAction<boolean>>;
  historialAbierto: boolean;
  setHistorialAbierto: Dispatch<SetStateAction<boolean>>;
  detalleCerrada: TarjetaTurno | null;
  setDetalleCerrada: Dispatch<SetStateAction<TarjetaTurno | null>>;

  /** Estado del reporte de salida del turno ACTUAL — derivado de datos
   * (servidor + outbox), nunca de un `useState` local (ver el TODO que
   * reemplaza, ex-Fase 4b). */
  reporteEstado: EstadoReporte;
  /** El último reporte YA confirmado por el servidor para este turno —
   * presente solo con `reporteEstado === 'enviado'`. */
  reporteUltimo: ShiftCardExitReport | null;
  /** Error de negocio del reporte en `needs_attention` — presente solo con
   * `reporteEstado === 'requiere-atencion'`. Reintentar/Descartar viven en
   * `SyncStatus` (acción genérica del outbox), no acá. */
  reporteError: OutboxLastError | null;
  /** `true` cuando ya hay un reporte 'enviado' pero `enCurso` cambió desde
   * entonces (se agregaron equipos) — habilita "Reenviar". */
  reportePuedeReenviar: boolean;
  enviarReporte: () => void;
  /** Cubre solo el encolado (mismo criterio que `isAbriendo`/`isCerrando`) —
   * protección anti-doble-toque mientras `liveQuery` no alcanzó a reflejar
   * la operación recién guardada. */
  isEnviandoReporte: boolean;
  /** URL de descarga del PDF de un reporte — la vista no importa
   * `ShiftReportAPI` directo (CLAUDE.md: "SOLO UI, consume los hooks"). */
  reporteUrl: (id: string) => string;
}

export function useShiftRegister(): UseShiftRegisterResult {
  const { data: equipos = [] } = useEquipment();
  const { data: operadores = [] } = useOperators({ isActive: true });
  const { data: tarjetasServidor = [], isPending: isLoadingTarjetas } = useShiftCardsMine();
  const { user, role } = useCurrentUser();
  const ops = useOutboxOps(user?.id);

  // El turno sale del reloj, no de un valor escrito en la pantalla — ver
  // `lib/turno.ts`.
  const ahora = useAhora();
  const clockCtx = useMemo(() => contextoTurno(ahora), [ahora]);

  // Selector "actual / siguiente" (ver `lib/shift-turno-override.ts`): el
  // override solo se guarda como el (turno, fecha) NATURAL del reloj en el
  // momento en que se pidió adelantar, así que queda obsoleto solo en
  // cuanto el reloj avanza más allá de ese par — no hay override "de ayer"
  // que se arrastre al turno de hoy.
  const [overrideActivo, setOverrideActivo] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    const guardado = readTurnoOverride(user.id);
    const vigente =
      !!guardado && guardado.baseTurno === clockCtx.turno && guardado.baseFecha === toDateOnly(clockCtx.fecha);
    setOverrideActivo(vigente);
    if (guardado && !vigente) clearTurnoOverride(user.id);
  }, [user?.id, clockCtx]);

  const siguiente = useMemo(() => turnoSiguiente(clockCtx.turno, clockCtx.fecha), [clockCtx]);
  // Memoizado: sin esto, `ctx` sería un objeto NUEVO en cada render mientras
  // `overrideActivo` es true, y arrastraría a re-computar de más los
  // `useMemo` que dependen de `ctx` más abajo (`anterior`, `tarjetas`).
  const ctx: ContextoTurno = useMemo(
    () =>
      overrideActivo
        ? {
            turno: siguiente.turno,
            fecha: siguiente.fecha,
            etiqueta: etiquetaTurno(siguiente.turno),
            fechaCorta: fechaCorta(siguiente.fecha),
            fechaHora: clockCtx.fechaHora,
          }
        : clockCtx,
    [overrideActivo, siguiente, clockCtx],
  );

  // Botón "adelantar turno": solo dentro de la ventana previa al cambio, o
  // si el override ya está activo (para poder volver) — un toque accidental
  // fuera de esa ventana no tiene ninguna razón real detrás y solo arriesga
  // cargar tarjetas en el turno equivocado.
  const mostrarSelectorTurno = puedeAdelantarTurno(ahora) || overrideActivo;

  const avanzarTurno = () => {
    if (!user?.id) return;
    saveTurnoOverride(user.id, { baseTurno: clockCtx.turno, baseFecha: toDateOnly(clockCtx.fecha) });
    setOverrideActivo(true);
  };
  const volverTurnoActual = () => {
    if (user?.id) clearTurnoOverride(user.id);
    setOverrideActivo(false);
  };

  const anterior = useMemo(() => turnoAnterior(ctx.turno, ctx.fecha), [ctx]);

  const supervisor = user?.name?.trim() || user?.email || 'Sin identificar';
  const veTodo = role === ROLES.ADMIN;

  // --- Proyección offline-first: servidor + outbox, merge por id ------------

  const opsAbrir = useMemo(() => ops.filter((op): op is OpenCardOp => op.type === 'openCard'), [ops]);
  const opsCerrar = useMemo(() => ops.filter((op): op is CloseCardOp => op.type === 'closeCard'), [ops]);
  const opsReporte = useMemo(() => ops.filter((op): op is SendExitReportOp => op.type === 'sendExitReport'), [ops]);

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

  const [apertura, setApertura] = useState<AperturaState>(DEFAULT_APERTURA);
  const equipoElegido = disponibles.find((e) => e.id === apertura.equipoId) ?? disponibles[0];
  const valorInicialApertura = aNumero(apertura.horometro) ?? equipoElegido?.currentHourmeter ?? null;

  const [cierre, setCierre] = useState<CierreState>(DEFAULT_CIERRE);

  /** Foto del surtidor, OCR y EXIF — mismo flujo compartido de Flota que ya
   * usaba la maqueta (`usePhotoCaptureFlow` + `FotoRespaldoField`). La
   * SUBIDA ya no la dispara esta pantalla (`foto.upload` quedó sin uso acá):
   * el archivo se guarda comprimido en Dexie (`enqueueCloseCard`) y se sube
   * recién durante el replay (`offline/replay.ts`). */
  const foto = usePhotoCaptureFlow((litros) =>
    setCierre((c) => ({
      ...c,
      litros: litros.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    })),
  );

  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  const [verReporte, setVerReporte] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [detalleCerrada, setDetalleCerrada] = useState<TarjetaTurno | null>(null);

  const cerrando = tarjetas.find((t) => t.id === cerrandoId) ?? null;
  const finalNum = aNumero(cierre.final);
  const horasMaquina = cerrando && finalNum != null ? finalNum - cerrando.inicial : null;
  const finalInvalido = horasMaquina != null && horasMaquina < 0;

  // `isAbriendo`/`isCerrando` ahora solo cubren el ENCOLADO (rápido, un
  // `put` a Dexie) — la subida y el POST real pasan en segundo plano en el
  // replay. Igual queda la protección anti-doble-toque: mientras el
  // encolado está en vuelo, un segundo toque no hace nada.
  const [isAbriendo, setIsAbriendo] = useState(false);
  const [isCerrando, setIsCerrando] = useState(false);

  const abrir = () => {
    // Sin fallback a `0`: si no hay horómetro tipeado NI último registrado
    // del equipo, no hay ningún valor que mandar — el botón ya queda
    // deshabilitado en la vista con esta misma condición (`valorInicialApertura`).
    if (!equipoElegido || !apertura.operatorId || valorInicialApertura == null || isAbriendo) return;
    if (!user?.id) return;
    setIsAbriendo(true);
    void enqueueOpenCard(user.id, {
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

  const abrirCierre = (id: string) => {
    setCerrandoId(id);
    setCierre(DEFAULT_CIERRE);
    // La foto es de ESTA tarjeta: arrastrar la anterior mezclaría el
    // respaldo de un equipo con el de otro.
    foto.resetPhoto();
  };

  const cerrar = async () => {
    if (!cerrando || finalNum == null || finalInvalido || !foto.file || isCerrando) return;
    if (!user?.id) return;

    setIsCerrando(true);
    try {
      await enqueueCloseCard(
        user.id,
        cerrando.id,
        {
          closeClientId: generateUuid(),
          valorFinal: finalNum,
          fuelLiters: aNumero(cierre.litros) ?? 0,
          observaciones: cierre.observaciones.trim() || undefined,
          capturedAt: new Date().toISOString(),
          photoCapturedAt: foto.captureDate ? foto.captureDate.toISOString() : undefined,
        },
        foto.file,
      );
      setCerrandoId(null);
      foto.resetPhoto();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'No se pudo guardar el cierre en el equipo.');
    } finally {
      setIsCerrando(false);
    }
  };

  // --- Reporte de salida (Fase 5: conectado al outbox) -----------------------

  const shiftActualServidor = useMemo(
    () => tarjetasServidor.find((c) => c.shift != null && esActual(c.shift.date, c.shift.type, ctx))?.shift ?? null,
    [tarjetasServidor, ctx],
  );
  const reporteUltimo = useMemo(() => {
    const reports = shiftActualServidor?.exitReports ?? [];
    if (reports.length === 0) return null;
    return reports.reduce((latest, r) => (r.requestedAt > latest.requestedAt ? r : latest));
  }, [shiftActualServidor]);

  const opReporteActual = useMemo(
    () => opsReporte.find((op) => op.payload.shiftDate === toDateOnly(ctx.fecha) && op.payload.shiftType === ctx.turno),
    [opsReporte, ctx],
  );

  let reporteEstado: EstadoReporte;
  let reporteError: OutboxLastError | null = null;
  if (opReporteActual?.status === 'needs_attention') {
    reporteEstado = 'requiere-atencion';
    reporteError = opReporteActual.lastError ?? null;
  } else if (opReporteActual) {
    reporteEstado = 'en-cola';
  } else if (reporteUltimo) {
    reporteEstado = 'enviado';
  } else {
    reporteEstado = 'sin-enviar';
  }

  const reportePuedeReenviar =
    reporteEstado === 'enviado' && reporteUltimo != null && enCurso.length !== reporteUltimo.cardCount;

  // Doble-toque/duplicados (revisión de la Fase 5): sin esto, dos toques
  // antes de que `liveQuery` alcance a reflejar el primer encolado (`opsReporte`
  // todavía no lo trae) generaban DOS operaciones con uuids distintos → dos
  // PDF y dos rondas de correo. `isEnviandoReporte` cubre la ventana del
  // encolado en sí (rápida mientras `liveQuery` no refresca); `opReporteActual`
  // cubre todo lo que sigue: mientras ya exista una operación de reporte
  // para ESTE turno (`shiftDate`+`shiftType`) — pendiente, sincronizando O EN
  // `needs_attention` — no se encola otra. Un `needs_attention` se
  // reintenta/descarta desde `SyncStatus`, nunca disparando un segundo
  // reporte por acá.
  const [isEnviandoReporte, setIsEnviandoReporte] = useState(false);

  const enviarReporte = () => {
    if (!user?.id || enCurso.length === 0 || isEnviandoReporte || opReporteActual) return;
    setIsEnviandoReporte(true);
    void enqueueExitReport(user.id, {
      id: generateUuid(),
      shiftDate: toDateOnly(ctx.fecha),
      shiftType: ctx.turno,
      cardIds: enCurso.map((t) => t.id),
      requestedAt: new Date().toISOString(),
    })
      .catch((error: unknown) => {
        toast.danger(error instanceof Error ? error.message : 'No se pudo poner en cola el reporte de salida.');
      })
      .finally(() => setIsEnviandoReporte(false));
  };

  return {
    ctx,
    anterior,
    turnoSeleccion: overrideActivo ? 'siguiente' : 'reloj',
    siguienteTurno: siguiente.turno,
    avanzarTurno,
    volverTurnoActual,
    mostrarSelectorTurno,
    supervisor,
    veTodo,
    disponibles,
    enTaller,
    equipoHint,
    operadores,
    abiertasActual,
    abiertasAnterior,
    cerradas,
    enCurso,
    isLoadingTarjetas,
    apertura,
    setApertura,
    equipoElegido,
    valorInicialApertura,
    abrir,
    isAbriendo,
    cerrandoId,
    setCerrandoId,
    cerrando,
    cierre,
    setCierre,
    abrirCierre,
    cerrar,
    finalNum,
    horasMaquina,
    finalInvalido,
    isCerrando,
    foto,
    verReporte,
    setVerReporte,
    historialAbierto,
    setHistorialAbierto,
    detalleCerrada,
    setDetalleCerrada,
    reporteEstado,
    reporteUltimo,
    reporteError,
    reportePuedeReenviar,
    enviarReporte,
    isEnviandoReporte,
    reporteUrl: ShiftReportAPI.fileUrl,
  };
}
