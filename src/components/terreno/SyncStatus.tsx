import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X, XCircle } from 'lucide-react';

import { usePrepareOffline } from '../../hooks/usePrepareOffline';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { CONTAINER } from '../../layout/TerrenoLayout';
import type { CloseCardOp, OutboxOp } from '../../offline/db';
import { discardOp, retryOp } from '../../offline/outbox';
import { useOutboxOps } from '../../offline/useOutboxOps';
import { useSyncState } from '../../offline/replay';
import { syncStatusPresentation, type SyncStatusTono } from '../../offline/sync-status-presentation';

/**
 * Barra + hoja de estado de sincronización — reemplaza a `BarraSinSenal`
 * (`layout/TerrenoLayout.tsx`), que prometía "se envía solo al volver la
 * conexión" sin ningún código detrás (RFC "Supervisión en Terreno" §Diseño
 * → Offline). Acá el contador es REAL: sale del outbox de Dexie
 * (`offline/replay.ts#useSyncState`), en vivo.
 *
 * Consumidor puro de `useSyncState()` — el motor (`useSyncEngine()`) vive a
 * nivel de sesión en `components/SyncEngineMount.tsx`, no acá: si viviera
 * en este componente (montado solo dentro de `TerrenoLayout`), navegar a
 * `/` lo desmontaría y la sincronización se detendría hasta volver a
 * Terreno.
 */

function labelOp(op: OutboxOp): string {
  switch (op.type) {
    case 'openCard':
      return 'Apertura de tarjeta';
    case 'closeCard':
      return 'Cierre de tarjeta';
    case 'sendExitReport':
      return 'Reporte de salida';
  }
}

/** El `closeCard` que depende de ESTE `openCard` (misma `cardId`), si
 * existe: `nextPendingOp` (`offline/replay.ts`) lo retiene sin mandarlo
 * mientras la apertura siga en `needs_attention`, así que acá se avisa por
 * qué ese cierre no avanza, y `discardOp` (`offline/outbox.ts`) lo arrastra
 * si se descarta la apertura. Busca en TODAS las operaciones (no solo las
 * de atención): el cierre dependiente sigue `pending_upload`/`pending_claim`,
 * nunca `needs_attention` por sí mismo. */
function cierreDependiente(op: OutboxOp, ops: OutboxOp[]): CloseCardOp | undefined {
  if (op.type !== 'openCard') return undefined;
  return ops.find((o): o is CloseCardOp => o.type === 'closeCard' && o.payload.cardId === op.id);
}

function PrepItemRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success-soft-foreground)]" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" />
      )}
      {children}
    </div>
  );
}

export function SyncStatus() {
  const { user, isOfflineSnapshot } = useCurrentUser();
  const enLinea = useOnlineStatus();
  const sync = useSyncState(user?.id);
  const ops = useOutboxOps(user?.id);
  const opsAtencion = ops.filter((op) => op.status === 'needs_attention');
  const { preparando, resultadoPrep, handlePreparar } = usePrepareOffline();

  const [abierto, setAbierto] = useState(false);
  const [descartando, setDescartando] = useState<string | null>(null);

  const { tono, icono, texto } = syncStatusPresentation(sync, isOfflineSnapshot, enLinea);

  const estilos: Record<SyncStatusTono, string> = {
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[#f3c9c9]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)] border-[#f1d9a2]',
    success: 'bg-[var(--success-soft)] text-[var(--success-soft-foreground)] border-[#bfe3cd]',
    neutral: 'bg-white/10 text-white border-transparent',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`flex-none border-b text-[13px] leading-snug ${estilos[tono]}`}
      >
        <div className={`${CONTAINER} flex items-start gap-2.5 py-2.5 text-left`}>
          {icono}
          <span className="flex-1">{texto}</span>
        </div>
      </button>

      {abierto && (
        <>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-40 bg-[#0d0c0a]/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sincronización"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88%] overflow-y-auto rounded-t-[28px] bg-card shadow-[0_-10px_40px_rgba(13,12,10,.2)] lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:max-h-[86%] lg:w-[600px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl"
          >
            <div className="mx-auto flex max-w-md flex-col gap-3.5 px-4 pt-2.5 pb-[22px] sm:max-w-[560px] lg:max-w-none lg:px-6 lg:pt-[22px] lg:pb-6">
              <div className="mx-auto mb-1 h-[5px] w-11 rounded-full bg-[#cfd4da] lg:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                    Sincronización
                  </span>
                  <h2 className="mt-1 text-[19px] font-bold tracking-[-0.01em]">Registros sin señal</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#eef0f2]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {sync.authRequired && (
                <div className="flex flex-col gap-2 rounded-2xl bg-[var(--danger-soft)] p-3.5 text-sm text-[var(--danger)]">
                  <span>
                    <b>Tu sesión expiró.</b> Iniciá sesión de nuevo con el mismo usuario para que la sincronización
                    continúe sola.
                  </span>
                  <Link
                    to="/login"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground"
                  >
                    Iniciar sesión
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3.5 py-3 text-sm">
                <span className="text-muted-foreground">Pendientes por sincronizar</span>
                <b className="tabular">{sync.pendingCount}</b>
              </div>

              {opsAtencion.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">Ningún registro requiere atención.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                    Requieren atención
                  </span>
                  {opsAtencion.map((op) => {
                    const dependiente = cierreDependiente(op, ops);
                    return (
                      <div key={op.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{labelOp(op)}</span>
                          <Circle className="mt-1 h-2 w-2 shrink-0 fill-[var(--danger)] text-[var(--danger)]" />
                        </div>
                        <p className="m-0 text-[13px] text-[var(--danger)]">
                          {op.lastError?.message ?? 'El servidor rechazó esta operación.'}
                        </p>
                        {dependiente && (
                          <p className="m-0 text-[12.5px] text-muted-foreground">
                            Esta tarjeta también tiene un cierre guardado (con foto): se envía solo cuando resuelvas
                            la apertura.
                          </p>
                        )}
                        {descartando === op.id ? (
                          <div className="flex flex-col gap-2 rounded-xl bg-[var(--danger-soft)] p-2.5">
                            <span className="text-[12.5px] font-semibold text-[var(--danger)]">
                              {dependiente
                                ? 'Se descarta la apertura y también su cierre guardado con la foto. No se puede deshacer.'
                                : '¿Descartar? No se puede deshacer.'}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (user?.id) void discardOp(op.id, user.id);
                                  setDescartando(null);
                                }}
                                className="min-h-9 flex-1 rounded-lg bg-[var(--danger)] text-[13px] font-semibold text-white"
                              >
                                Sí, descartar
                              </button>
                              <button
                                type="button"
                                onClick={() => setDescartando(null)}
                                className="min-h-9 flex-1 rounded-lg border border-border text-[13px] font-semibold"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => user?.id && void retryOp(op.id, user.id)}
                              className="min-h-9 flex-1 rounded-lg border border-border text-[13px] font-semibold"
                            >
                              Reintentar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDescartando(op.id)}
                              className="min-h-9 flex-1 rounded-lg border border-border text-[13px] font-semibold text-[var(--danger)]"
                            >
                              Descartar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-border pt-3.5">
                <span className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  Antes de ir a terreno
                </span>
                <p className="m-0 text-[13px] text-muted-foreground">
                  Precarga los equipos, operadores y tarjetas activas para que la pantalla abra igual sin señal.
                </p>
                <button
                  type="button"
                  disabled={preparando}
                  onClick={() => void handlePreparar()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {preparando ? 'Preparando…' : 'Preparar para uso sin señal'}
                </button>

                {resultadoPrep && (
                  <div className="flex flex-col gap-1.5 rounded-2xl bg-[#fafbfc] p-3">
                    <PrepItemRow ok={resultadoPrep.persist === 'ok'}>Almacenamiento reservado</PrepItemRow>
                    <PrepItemRow ok={resultadoPrep.equipment === 'ok'}>Equipos precargados</PrepItemRow>
                    <PrepItemRow ok={resultadoPrep.operators === 'ok'}>Operadores precargados</PrepItemRow>
                    <PrepItemRow ok={resultadoPrep.shiftCards === 'ok'}>Tarjetas propias precargadas</PrepItemRow>
                    {!resultadoPrep.installed && (
                      <p className="m-0 mt-1 text-[12.5px] font-medium text-[var(--warning-soft-foreground)]">
                        Instalá la app en la pantalla de inicio: en iPad, Safari borra los datos guardados de las
                        páginas no instaladas después de 7 días sin uso.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
