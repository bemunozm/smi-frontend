import { useMemo, useState } from 'react';
import { toast } from '@heroui/react';

import { esActual, type EstadoReporte, type TarjetaTurno } from './shift-register-helpers';
import { ShiftReportAPI } from '../api/ShiftReportAPI';
import type { OutboxLastError, SendExitReportOp, OutboxOp } from '../offline/db';
import { enqueueExitReport } from '../offline/outbox';
import { toDateOnly, type ContextoTurno } from '../lib/turno';
import { generateUuid } from '../lib/uuid';
import type { ShiftCardExitReport, ShiftCardResponse } from '../types/shift';

export interface UseExitReportStateParams {
  tarjetasServidor: ShiftCardResponse[];
  ctx: ContextoTurno;
  ops: OutboxOp[];
  /** Las tarjetas que entran en el reporte de salida: `abiertasActual` (más
   * livianos cerrados por mí) en el flujo vivo, o las CERRADAS del turno
   * elegido en el modo "registrar un turno pasado" (un turno terminado no
   * tiene nada en curso). */
  enCurso: TarjetaTurno[];
  /** Reportes YA enviados del turno (resumen `GET /api/shifts?date&type`,
   * modo pasado) — "mis tarjetas" solo baja lo cerrado en 48 h, así que un
   * turno backfilleado hace días no traería su reporte por `tarjetasServidor`. */
  reportesPrevios?: ShiftCardExitReport[];
  userId: string | undefined;
}

export interface UseExitReportStateResult {
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

/**
 * Reporte de salida del turno actual, conectado al outbox — sub-hook de
 * `useShiftRegister`.
 */
export function useExitReportState({
  tarjetasServidor,
  ctx,
  ops,
  enCurso,
  reportesPrevios,
  userId,
}: UseExitReportStateParams): UseExitReportStateResult {
  const opsReporte = useMemo(() => ops.filter((op): op is SendExitReportOp => op.type === 'sendExitReport'), [ops]);

  const shiftActualServidor = useMemo(
    () => tarjetasServidor.find((c) => c.shift != null && esActual(c.shift.date, c.shift.type, ctx))?.shift ?? null,
    [tarjetasServidor, ctx],
  );
  const reporteUltimo = useMemo(() => {
    // Dedupe por id: el mismo reporte puede venir por las dos fuentes.
    const porId = new Map(
      [...(shiftActualServidor?.exitReports ?? []), ...(reportesPrevios ?? [])].map((r) => [r.id, r]),
    );
    const reports = [...porId.values()];
    if (reports.length === 0) return null;
    return reports.reduce((latest, r) => (r.requestedAt > latest.requestedAt ? r : latest));
  }, [shiftActualServidor, reportesPrevios]);

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

  // Doble-toque/duplicados: sin este guard, dos toques antes de que
  // `liveQuery` alcance a reflejar el primer encolado (`opsReporte` todavía
  // no lo trae) generaban DOS operaciones con uuids distintos → dos PDF y
  // dos rondas de correo. `isEnviandoReporte` cubre la ventana del encolado
  // en sí (rápida mientras `liveQuery` no refresca); `opReporteActual` cubre
  // todo lo que sigue: mientras ya exista una operación de reporte para
  // ESTE turno (`shiftDate`+`shiftType`) — pendiente, sincronizando O EN
  // `needs_attention` — no se encola otra. Un `needs_attention` se
  // reintenta/descarta desde `SyncStatus`, nunca disparando un segundo
  // reporte por acá.
  const [isEnviandoReporte, setIsEnviandoReporte] = useState(false);

  const enviarReporte = () => {
    if (!userId || enCurso.length === 0 || isEnviandoReporte || opReporteActual) return;
    setIsEnviandoReporte(true);
    void enqueueExitReport(userId, {
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
    reporteEstado,
    reporteUltimo,
    reporteError,
    reportePuedeReenviar,
    enviarReporte,
    isEnviandoReporte,
    reporteUrl: ShiftReportAPI.fileUrl,
  };
}
