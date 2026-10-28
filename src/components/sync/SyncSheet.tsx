import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Drawer } from '@heroui/react';

import { plural } from '../../lib/format';
import { syncNow, type SyncState } from '../../offline/replay';

/**
 * Hoja de "Sincronización": se abre desde la barra de Terreno y desde el badge de
 * la barra superior de oficina. Es solo el marco — aviso de sesión vencida,
 * contador de pendientes y el `children` que cada lado arma (lista de la cola,
 * "Preparar para uso sin señal") —, así Terreno y oficina no divergen.
 *
 * Es un `Drawer` de HeroUI (inferior): trampa de foco, Escape para cerrar, `aria`
 * de diálogo y scroll del cuerpo vienen del componente, no a mano.
 */
export function SyncSheet({
  sync,
  isOpen,
  onClose,
  children,
}: {
  sync: Pick<SyncState, 'authRequired' | 'pendingCount' | 'attentionCount' | 'otherAccountCount' | 'syncing'>;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Content placement="bottom">
        <Drawer.Dialog className="mx-auto w-full max-w-160 gap-3.5">
          <Drawer.Handle />
          <Drawer.CloseTrigger aria-label="Cerrar" />
          <Drawer.Header>
            <span className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Sincronización
            </span>
            <Drawer.Heading className="font-display text-xl font-bold tracking-[-0.01em]">
              Registros sin señal
            </Drawer.Heading>
          </Drawer.Header>

          <Drawer.Body className="flex flex-col gap-3.5">
            {sync.authRequired && (
              <div className="flex flex-col gap-2 rounded-2xl bg-danger-soft p-3.5 text-sm text-danger-soft-foreground">
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
              <span className="text-muted-foreground">Sin sincronizar</span>
              <b className="tabular text-foreground">{sync.pendingCount + sync.attentionCount}</b>
            </div>
            {sync.pendingCount + sync.attentionCount > 0 && (
              <p className="m-0 text-[12.5px] text-muted-foreground">
                {[
                  sync.pendingCount > 0 ? `${sync.pendingCount} esperando señal` : null,
                  sync.attentionCount > 0
                    ? `${sync.attentionCount} ${sync.attentionCount === 1 ? 'requiere' : 'requieren'} atención`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}

            {/* Intento manual: en terreno el navegador puede quedarse "pegado" en
                offline aunque la señal ya volvió, y el disparador automático más
                cercano puede tardar 45 s — este botón pide un run YA, que además
                ignora `navigator.onLine` (ver `offline/replay.ts#syncNow`). Sin
                sesión no se ofrece: el envío rebotaría con 401 igual. */}
            {sync.pendingCount > 0 && !sync.authRequired && (
              // No `isDisabled` mientras sincroniza: un botón deshabilitado pierde
              // el foco, y con el foco en <body> Escape deja de cerrar la hoja
              // (mismo criterio que el botón de `PrepChecklist`).
              <Button
                aria-disabled={sync.syncing}
                variant="secondary"
                className={`min-h-12 ${sync.syncing ? 'opacity-60' : ''}`}
                onPress={() => {
                  if (!sync.syncing) syncNow();
                }}
              >
                {sync.syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Button>
            )}

            {sync.otherAccountCount > 0 && (
              <p className="m-0 text-[12.5px] text-muted-foreground">
                Este equipo también guarda {plural(sync.otherAccountCount, 'registro', 'registros')} sin enviar de otra
                cuenta: {sync.otherAccountCount === 1 ? 'se envía' : 'se envían'} cuando esa persona vuelva a iniciar sesión.
              </p>
            )}

            {children}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
