import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

import type { SyncState } from '../../offline/replay';

/**
 * Hoja de "Sincronización": se abre desde la barra de Terreno y desde el badge de
 * la barra superior de oficina. Es solo el marco — aviso de sesión vencida,
 * contador de pendientes y el `children` que cada lado arma (lista de atención,
 * "Preparar para uso sin señal") —, así Terreno y oficina no divergen.
 *
 * Sin dependencias de `TerrenoLayout`: es hoja inferior en teléfono y diálogo
 * centrado en pantallas anchas.
 */
export function SyncSheet({
  sync,
  onClose,
  children,
}: {
  sync: Pick<SyncState, 'authRequired' | 'pendingCount'>;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="fixed inset-0 z-40 bg-[#0d0c0a]/45" />
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
              onClick={onClose}
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

          {children}
        </div>
      </div>
    </>
  );
}
