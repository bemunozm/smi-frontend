import { useMemo, useState } from 'react';
import { Button, Card, Spinner, ToggleButton, ToggleButtonGroup } from '@heroui/react';

import { NotificationItem } from '../components/notifications/NotificationItem';
import { useMarkAllRead, useNotificaciones } from '../hooks/useNotificaciones';
import { notificacionTipoConfig } from '../config/notificacion-colors';
import { NOTIF_TIPOS, type NotificacionTipo } from '../types/notificacion';

const TODOS_TIPOS = Object.values(NOTIF_TIPOS);

const ESTADO_TODAS = 'todas';
const ESTADO_NO_LEIDAS = 'no-leidas';

/**
 * Centro de notificaciones completo (`/notificaciones`, ruta universal —
 * ver `routes.tsx`/`config/nav-items.ts`). Reutiliza `NotificationItem`
 * (mismo componente que el dropdown de la campana en `NotificationBell`).
 * Filtros locales (estado + tipo) sobre la lista ya cargada por
 * `useNotificaciones` — no son parámetros de la API.
 */
export function NotificacionesView() {
  const { data: notificaciones, isPending, isError, error } = useNotificaciones();
  const markAllRead = useMarkAllRead();

  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [tiposSeleccionados, setTiposSeleccionados] = useState<Set<NotificacionTipo>>(
    () => new Set(TODOS_TIPOS),
  );

  const lista = useMemo(() => notificaciones ?? [], [notificaciones]);
  const unreadCount = useMemo(() => lista.filter((n) => !n.leida).length, [lista]);

  const filtradas = useMemo(
    () =>
      lista.filter((n) => {
        if (soloNoLeidas && n.leida) return false;
        return tiposSeleccionados.has(n.tipo as NotificacionTipo);
      }),
    [lista, soloNoLeidas, tiposSeleccionados],
  );

  const resetFiltros = (): void => {
    setSoloNoLeidas(false);
    setTiposSeleccionados(new Set(TODOS_TIPOS));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Notificaciones
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} ${unreadCount === 1 ? 'notificación sin leer.' : 'notificaciones sin leer.'}`
              : 'Estás al día.'}
          </p>
        </div>
        <Button
          isDisabled={unreadCount === 0}
          isPending={markAllRead.isPending}
          variant="secondary"
          onPress={() => markAllRead.mutate()}
        >
          Marcar todas como leídas
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <ToggleButtonGroup
          aria-label="Filtrar por estado"
          disallowEmptySelection
          selectedKeys={new Set([soloNoLeidas ? ESTADO_NO_LEIDAS : ESTADO_TODAS])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            setSoloNoLeidas(Array.from(keys)[0] === ESTADO_NO_LEIDAS);
          }}
        >
          <ToggleButton id={ESTADO_TODAS}>Todas</ToggleButton>
          <ToggleButton id={ESTADO_NO_LEIDAS}>No leídas ({unreadCount})</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          aria-label="Filtrar por tipo"
          selectedKeys={tiposSeleccionados}
          selectionMode="multiple"
          onSelectionChange={(keys) => {
            const next = new Set<NotificacionTipo>();
            keys.forEach((key) => {
              if (typeof key === 'string' && (TODOS_TIPOS as string[]).includes(key)) {
                next.add(key as NotificacionTipo);
              }
            });
            setTiposSeleccionados(next);
          }}
        >
          {TODOS_TIPOS.map((tipo) => (
            <ToggleButton key={tipo} id={tipo}>
              {notificacionTipoConfig(tipo).label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de notificaciones.'}
        </div>
      ) : null}

      {!isPending && !isError && lista.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No tienes notificaciones</p>
          <p className="text-sm text-muted-foreground">Acá aparecerán los avisos del sistema.</p>
        </div>
      ) : null}

      {!isPending && !isError && lista.length > 0 && filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">Ningún aviso coincide con el filtro</p>
          <p className="text-sm text-muted-foreground">Prueba ajustando los filtros de arriba.</p>
          <Button size="sm" variant="tertiary" onPress={resetFiltros}>
            Restablecer filtros
          </Button>
        </div>
      ) : null}

      {filtradas.length > 0 ? (
        <div className="flex flex-col gap-2">
          {filtradas.map((notificacion) => (
            <Card className="overflow-hidden p-0" key={notificacion.id}>
              <NotificationItem notificacion={notificacion} />
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
