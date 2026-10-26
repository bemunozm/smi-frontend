import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Drawer, Dropdown, Spinner } from '@heroui/react';
import { Bell } from 'lucide-react';

import { DESKTOP_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { useMarkAllRead, useNotificaciones, useUnreadCount } from '../../hooks/useNotificaciones';
import { NotificationItem } from './NotificationItem';

/** Máximo de notificaciones que se listan en el dropdown — el resto se ve en `/notificaciones`. */
const MAX_ITEMS = 8;

export interface NotificationBellProps {
  /**
   * `true` cuando la campana vive en el header oscuro del shell de faena
   * (Terreno/Taller): trigger claro sobre el fondo oscuro y tamaño de guante
   * (el mismo 44px del botón de menú del shell). Sin la prop queda el look
   * del Topbar de escritorio.
   */
  faena?: boolean;
}

/**
 * Campana de notificaciones: ícono con badge de no-leídas (`useUnreadCount`,
 * polling cada 30s) que abre un `Dropdown` con las últimas notificaciones
 * (`useNotificaciones`). Vive en el Topbar de escritorio y, con `faena`, en el
 * header de los shells de Terreno/Taller. El `isOpen` se controla a mano
 * porque el contenido del popover no son `Dropdown.Item` (son botones con
 * navegación propia vía `NotificationItem`), así que nada lo cierra solo —
 * cada click adentro debe cerrarlo explícitamente.
 *
 * En tablet y celular (bajo `lg`) el popover de 320–384 px quedaba angosto,
 * cortado contra el borde y sobre el contenido: ahí se abre como hoja inferior
 * a todo el ancho (mismo patrón que la hoja de sincronización), con el texto
 * completo y botones del tamaño del dedo.
 */
export function NotificationBell({ faena = false }: NotificationBellProps = {}) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: unreadCount } = useUnreadCount();
  const { data: notificaciones, isPending, isError } = useNotificaciones();
  const markAllRead = useMarkAllRead();

  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  const count = unreadCount ?? 0;
  const items = (notificaciones ?? []).slice(0, MAX_ITEMS);
  const hasUnread = count > 0;

  const campana = (
    <Badge.Anchor>
      <Button
        aria-label="Notificaciones"
        className={faena ? 'h-11 w-11 rounded-xl text-white/90 hover:bg-white/10' : undefined}
        isIconOnly
        variant="ghost"
        onPress={esEscritorio ? undefined : () => setIsOpen(true)}
      >
        <Bell size={faena ? 22 : 18} />
      </Button>
      {hasUnread ? (
        <Badge color="danger" size="sm">
          {count > 99 ? '99+' : count}
        </Badge>
      ) : null}
    </Badge.Anchor>
  );

  const lista = (
    <>
      {isPending ? (
        <div className="flex justify-center py-8">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}

      {isError ? (
        <p className="px-3 py-6 text-center text-sm text-danger-soft-foreground">
          No se pudieron cargar las notificaciones.
        </p>
      ) : null}

      {!isPending && !isError && items.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">No tienes notificaciones todavía.</p>
      ) : null}

      {items.map((notificacion) => (
        <NotificationItem key={notificacion.id} notificacion={notificacion} onAfterClick={() => setIsOpen(false)} />
      ))}
    </>
  );

  if (!esEscritorio) {
    return (
      <>
        {campana}
        <Drawer.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog className="mx-auto w-full max-w-160 gap-3">
              <Drawer.Handle />
              <Drawer.CloseTrigger aria-label="Cerrar" />
              <Drawer.Header>
                <Drawer.Heading className="font-display text-xl font-bold tracking-[-0.01em]">
                  Notificaciones
                </Drawer.Heading>
                <span className="text-sm text-muted-foreground">
                  {hasUnread ? `${count} sin leer` : 'Todo leído'}
                </span>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-1 [&_p]:line-clamp-none [&>button]:rounded-xl [&>button]:border [&>button]:border-border [&>button]:px-4 [&>button]:py-3">
                {lista}
              </Drawer.Body>
              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
                <Button
                  className="min-h-11 w-full sm:w-auto sm:flex-1"
                  isDisabled={!hasUnread}
                  isPending={markAllRead.isPending}
                  variant="secondary"
                  onPress={() => markAllRead.mutate()}
                >
                  Marcar todas como leídas
                </Button>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-(--accent) hover:underline sm:flex-1"
                  to="/notificaciones"
                  onClick={() => setIsOpen(false)}
                >
                  Ver todas
                </Link>
              </div>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </>
    );
  }

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      {campana}

      <Dropdown.Popover className="flex w-80 flex-col sm:w-96" placement="bottom end">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">Notificaciones</span>
          <Button
            isDisabled={!hasUnread}
            isPending={markAllRead.isPending}
            size="sm"
            variant="ghost"
            onPress={() => markAllRead.mutate()}
          >
            Marcar todas como leídas
          </Button>
        </div>

        <div className="flex max-h-96 flex-col gap-0.5 overflow-y-auto p-1.5">{lista}</div>

        <div className="border-t border-border px-3 py-2">
          <Link
            className="text-sm text-(--accent) hover:underline"
            to="/notificaciones"
            onClick={() => setIsOpen(false)}
          >
            Ver todas
          </Link>
        </div>
      </Dropdown.Popover>
    </Dropdown>
  );
}
