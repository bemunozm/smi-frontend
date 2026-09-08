import { useNavigate } from 'react-router-dom';
import { Chip } from '@heroui/react';

import { useMarkRead } from '../../hooks/useNotificaciones';
import { notificacionTipoConfig } from '../../config/notificacion-colors';
import { relativeTime } from '../../lib/relative-time';
import type { Notificacion } from '../../types/notificacion';

function equipoIdFrom(data: Notificacion['data']): string | null {
  if (!data) return null;
  const { equipoId } = data;
  return typeof equipoId === 'string' && equipoId.length > 0 ? equipoId : null;
}

export interface NotificationItemProps {
  notificacion: Notificacion;
  /** Se ejecuta al final del click (mismo tenga o no navegación) — el
   * dropdown de la campana lo usa para cerrarse a sí mismo. */
  onAfterClick?: () => void;
}

/**
 * Item de notificación reutilizable entre el dropdown de la campana
 * (`NotificationBell`) y el centro completo (`NotificacionesView`). El click
 * marca la notificación como leída (silencioso, sin toast — ver
 * `useMarkRead`) y navega a la ficha del equipo si `data.equipoId` viene en
 * la metadata.
 */
export function NotificationItem({ notificacion, onAfterClick }: NotificationItemProps) {
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const { label, color } = notificacionTipoConfig(notificacion.tipo);

  const handleClick = (): void => {
    markRead.mutate(notificacion.id);

    const equipoId = equipoIdFrom(notificacion.data);
    if (equipoId) navigate(`/equipos/${equipoId}/ficha`);

    onAfterClick?.();
  };

  return (
    <button
      className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-default-hover ${
        notificacion.leida ? '' : 'bg-accent-soft/40'
      }`}
      type="button"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {notificacion.leida ? null : (
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
          )}
          <Chip color={color} size="sm" variant="soft">
            {label}
          </Chip>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(notificacion.createdAt)}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{notificacion.titulo}</p>
      <p className="line-clamp-2 text-sm text-muted-foreground">{notificacion.cuerpo}</p>
    </button>
  );
}
