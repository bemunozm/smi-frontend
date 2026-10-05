import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '@heroui/react';

import { plural } from '../../lib/format';
import type { SyncState } from '../../offline/replay';

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
  sync: Pick<SyncState, 'authRequired' | 'pendingCount' | 'otherAccountCount'>;
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
              <span className="text-muted-foreground">Pendientes por sincronizar</span>
              <b className="tabular text-foreground">{sync.pendingCount}</b>
            </div>

            {sync.otherAccountCount > 0 && (
              <p className="m-0 text-[12.5px] text-muted-foreground">
                Este equipo también guarda {plural(sync.otherAccountCount, 'registro', 'registros')} sin enviar de otra
                cuenta: se envían cuando esa persona vuelva a iniciar sesión.
              </p>
            )}

            {children}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
