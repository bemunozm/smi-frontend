import { useState, type Dispatch, type SetStateAction } from 'react';

import { useCurrentUser } from './useCurrentUser';
import { useEquipment } from './useEquipment';
import { useOperators } from './useOperators';
import { useShiftCardsMine } from './useShiftCards';
import { useOutboxOps } from '../offline/useOutboxOps';
import { useAperturaForm, type AperturaState } from './useAperturaForm';
import { useCierreForm, type CierreState } from './useCierreForm';
import { useEditarTarjeta, type UseEditarTarjetaResult } from './useEditarTarjeta';
import { useExitReportState } from './useExitReportState';
import { useShiftProjection } from './useShiftProjection';
import { useTurnoSelector } from './useTurnoSelector';
import type { EstadoReporte, TarjetaTurno } from './shift-register-helpers';
import type { OutboxLastError } from '../offline/db';
import type { ResultadoAdBlue } from '../lib/adblue';
import type { ContextoTurno, Turno } from '../lib/turno';
import type { UsePhotoCaptureFlowResult } from '../lib/usePhotoCaptureFlow';
import type { Equipment } from '../types/equipment';
import type { Operator } from '../types/operator';
import { ROLES } from '../types/roles';
import type { ShiftCardExitReport } from '../types/shift';

// Re-exportados tal cual (ver `shift-register-helpers.ts`): mismo import
// path (`./useShiftRegister`) que ya usaban `views/RegistroEquipoView.tsx`
// y `hooks/useShiftRegister.test.tsx` antes de separar el archivo.
export { lineaEstadoCorreo, mapCardToTarjeta } from './shift-register-helpers';
export type { Estado, EstadoReporte, Grupo, TarjetaTurno } from './shift-register-helpers';

/**
 * Adaptador de datos de Registro de equipo: devuelve el mismo view-model que la
 * maqueta. `views/RegistroEquipoView.tsx` consume ESTE shape tal cual.
 *
 * Es "offline-first": proyecta el servidor (`useShiftCardsMine`) MÁS las
 * operaciones pendientes del outbox (`useOutboxOps`, Dexie `liveQuery`) en
 * el MISMO view-model, y `abrir()`/`cerrar()`/`enviarReporte()` encolan en
 * vez de llamar a la API directo — un único camino, online u offline (ver
 * `offline/outbox.ts`, `offline/replay.ts`).
 *
 * Internamente se compone de sub-hooks (`useTurnoSelector`,
 * `useShiftProjection`, `useAperturaForm`, `useCierreForm`,
 * `useExitReportState`): cada uno cubre una responsabilidad propia, y este
 * archivo solo los conecta y expone el MISMO contrato público
 * (`UseShiftRegisterResult`) que ya consumía la vista.
 */

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

  apertura: AperturaState;
  setApertura: Dispatch<SetStateAction<AperturaState>>;
  equipoElegido: Equipment | undefined;
  /** `parseDecimal(apertura.horometro) ?? equipoElegido?.currentHourmeter`, SIN
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
  adBlueCierre: ResultadoAdBlue;
  adBlueIncompletoCierre: boolean;
  isCerrando: boolean;
  foto: UsePhotoCaptureFlowResult;

  /** Editar una tarjeta (abierta o cerrada) — ver `useEditarTarjeta`. */
  edicion: UseEditarTarjetaResult;

  verReporte: boolean;
  setVerReporte: Dispatch<SetStateAction<boolean>>;
  historialAbierto: boolean;
  setHistorialAbierto: Dispatch<SetStateAction<boolean>>;
  detalleCerrada: TarjetaTurno | null;
  setDetalleCerrada: Dispatch<SetStateAction<TarjetaTurno | null>>;

  /** Estado del reporte de salida del turno ACTUAL — derivado de datos
   * (servidor + outbox), nunca de un `useState` local. */
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
  const { data: tarjetasServidor = [] } = useShiftCardsMine();
  const { user, role } = useCurrentUser();
  const ops = useOutboxOps(user?.id);

  const supervisor = user?.name?.trim() || user?.email || 'Sin identificar';
  const veTodo = role === ROLES.ADMIN;

  const turno = useTurnoSelector(user?.id);
  const proyeccion = useShiftProjection({
    ctx: turno.ctx,
    equipos,
    operadores,
    tarjetasServidor,
    ops,
    supervisor,
  });
  const apertura = useAperturaForm({ disponibles: proyeccion.disponibles, ctx: turno.ctx, userId: user?.id });
  const cierre = useCierreForm({ tarjetas: proyeccion.tarjetas, userId: user?.id });
  const edicion = useEditarTarjeta({ tarjetas: proyeccion.tarjetas, ops, userId: user?.id });
  const reporte = useExitReportState({
    tarjetasServidor,
    ctx: turno.ctx,
    ops,
    enCurso: proyeccion.enCurso,
    userId: user?.id,
  });

  const [verReporte, setVerReporte] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [detalleCerrada, setDetalleCerrada] = useState<TarjetaTurno | null>(null);
  // El detalle abierto se lee de la proyeccion, no de la copia guardada: tras
  // editar, muestra el dato nuevo sin volver a abrirlo.
  const detalleCerradaVivo = detalleCerrada
    ? (proyeccion.tarjetas.find((t) => t.id === detalleCerrada.id) ?? detalleCerrada)
    : null;

  return {
    ...turno,
    supervisor,
    veTodo,
    disponibles: proyeccion.disponibles,
    enTaller: proyeccion.enTaller,
    equipoHint: proyeccion.equipoHint,
    operadores,
    abiertasActual: proyeccion.abiertasActual,
    abiertasAnterior: proyeccion.abiertasAnterior,
    cerradas: proyeccion.cerradas,
    enCurso: proyeccion.enCurso,
    ...apertura,
    ...cierre,
    edicion,
    verReporte,
    setVerReporte,
    historialAbierto,
    setHistorialAbierto,
    detalleCerrada: detalleCerradaVivo,
    setDetalleCerrada,
    ...reporte,
  };
}
