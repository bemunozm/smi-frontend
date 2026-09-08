import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Dropdown, Spinner } from '@heroui/react';
import { Bell } from 'lucide-react';

import { useMarkAllRead, useNotificaciones, useUnreadCount } from '../../hooks/useNotificaciones';
import { NotificationItem } from './NotificationItem';

/** Máximo de notificaciones que se listan en el dropdown — el resto se ve en `/notificaciones`. */
const MAX_ITEMS = 8;

/**
 * Campana del Topbar: ícono con badge de no-leídas (`useUnreadCount`, polling
 * cada 30s) que abre un `Dropdown` con las últimas notificaciones
 * (`useNotificaciones`). El `isOpen` se controla a mano porque el contenido
 * del popover no son `Dropdown.Item` (son botones con navegación propia vía
 * `NotificationItem`), así que nada lo cierra solo — cada click adentro debe
 * cerrarlo explícitamente.
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: unreadCount } = useUnreadCount();
  const { data: notificaciones, isPending, isError } = useNotificaciones();
  const markAllRead = useMarkAllRead();

  const count = unreadCount ?? 0;
  const items = (notificaciones ?? []).slice(0, MAX_ITEMS);
  const hasUnread = count > 0;

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <Badge.Anchor>
        <Button aria-label="Notificaciones" isIconOnly variant="ghost">
          <Bell size={18} />
        </Button>
        {hasUnread ? (
          <Badge color="danger" size="sm">
            {count > 99 ? '99+' : count}
          </Badge>
        ) : null}
      </Badge.Anchor>

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

        <div className="flex max-h-96 flex-col gap-0.5 overflow-y-auto p-1.5">
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
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No tienes notificaciones todavía.
            </p>
          ) : null}

          {items.map((notificacion) => (
            <NotificationItem
              key={notificacion.id}
              notificacion={notificacion}
              onAfterClick={() => setIsOpen(false)}
            />
          ))}
        </div>

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
