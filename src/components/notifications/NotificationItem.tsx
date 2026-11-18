import { useNavigate } from 'react-router-dom';
import { Chip } from '../ui/Chip';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useMarkRead } from '../../hooks/useNotificaciones';
import { useAbrirPdfReporte } from '../../hooks/useShiftReports';
import { notificacionTipoConfig } from '../../config/notificacion-colors';
import { relativeTime } from '../../lib/relative-time';
import { NOTIF_TIPOS, type Notificacion } from '../../types/notificacion';
import { rutaDeChecklist } from './checklist-route';
import { rutaDeGestion } from './gestion-route';
import { rutaDeRegistroEditado } from './record-edited-route';
import { rutaDeVencimiento } from './vencimiento-route';

function equipoIdFrom(data: Notificacion['data']): string | null {
  if (!data) return null;
  const { equipoId } = data;
  return typeof equipoId === 'string' && equipoId.length > 0 ? equipoId : null;
}

/** `/cargas-combustible?id=<carga>`: la vista abre el detalle de esa carga (y,
 * si ya no existe, solo muestra el listado). Sin `cargaId`, el listado. */
function rutaDeCarga(data: Notificacion['data']): string {
  const cargaId = data?.cargaId;
  return typeof cargaId === 'string' && cargaId.length > 0
    ? `/cargas-combustible?id=${encodeURIComponent(cargaId)}`
    : '/cargas-combustible';
}

function reportIdFrom(data: Notificacion['data']): string | null {
  if (!data) return null;
  const { reportId } = data;
  return typeof reportId === 'string' && reportId.length > 0 ? reportId : null;
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
  const abrirPdf = useAbrirPdfReporte();
  const navigate = useNavigate();
  const { role } = useCurrentUser();
  const { label, color, icono: Icono } = notificacionTipoConfig(notificacion.tipo);

  const handleClick = (): void => {
    markRead.mutate(notificacion.id);

    // `shift.exit-report`: no tiene una pantalla propia — abre el PDF en otra
    // pestaña (`useAbrirPdfReporte`: si el reporte se borró, avisa en la app en
    // vez del 404 crudo), no una navegación interna con
    // `navigate()`. Se resuelve ANTES que `equipoIdFrom` porque
    // `data.equipoId` no aplica a este tipo.
    const reportId = notificacion.tipo === NOTIF_TIPOS.SHIFT_EXIT_REPORT ? reportIdFrom(notificacion.data) : null;
    if (reportId) {
      abrirPdf(reportId);
      onAfterClick?.();
      return;
    }

    // Equipos que quedaron abiertos al terminar el turno: se cierran desde el
    // Informe diario.
    if (notificacion.tipo === NOTIF_TIPOS.SHIFT_OPEN_CARDS) {
      navigate('/terreno/registro');
      onAfterClick?.();
      return;
    }

    // Carga de combustible de una camioneta (solo la recibe el administrador): su
    // detalle en el panel de cargas.
    if (notificacion.tipo === NOTIF_TIPOS.FUEL_LOADED) {
      navigate(rutaDeCarga(notificacion.data));
      onAfterClick?.();
      return;
    }

    if (
      notificacion.tipo === NOTIF_TIPOS.CHECKLIST_SUBMITTED ||
      notificacion.tipo === NOTIF_TIPOS.CHECKLIST_REVIEWED
    ) {
      const ruta = rutaDeChecklist(notificacion, role);
      if (ruta) navigate(ruta);
      onAfterClick?.();
      return;
    }

    const rutaVencimiento = rutaDeVencimiento(notificacion, role);
    if (rutaVencimiento) {
      navigate(rutaVencimiento);
      onAfterClick?.();
      return;
    }

    if (notificacion.tipo === NOTIF_TIPOS.RECORD_EDITED) {
      const ruta = rutaDeRegistroEditado(notificacion.data);
      if (ruta) navigate(ruta);
      onAfterClick?.();
      return;
    }

    // El administrador va a su vista de gestión (hallazgos, mantenciones,
    // inventario); los demás roles caen al default de abajo (la ficha).
    const rutaGestion = rutaDeGestion(notificacion, role);
    if (rutaGestion) {
      navigate(rutaGestion);
      onAfterClick?.();
      return;
    }

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
            {Icono ? <Icono aria-hidden className="size-3.5" /> : null}
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
