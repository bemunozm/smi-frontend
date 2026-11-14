import { useState, type ReactNode } from 'react';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUpdateEquipmentStatus } from '../../hooks/useEquipment';
import { ROLES } from '../../types/roles';
import type { Equipment, EquipmentStatus, OpenShift } from '../../types/equipment';
import { CerrarUsoModal } from './CerrarUsoModal';

interface Pendiente {
  equipo: Equipment & { openShift: OpenShift };
  status: EquipmentStatus;
  onSuccess?: () => void;
}

/**
 * Cambio de estado de un equipo desde cualquier menú (listado, hoja móvil,
 * ficha). Si el ADMINISTRADOR lo deja fuera de servicio o en taller y el
 * equipo tiene un uso en curso (tarjeta abierta), primero pide cerrarlo
 * (`CerrarUsoModal`): si no, el equipo quedaba «Fuera de servicio» y a la vez
 * «En uso» a nombre del operador y el supervisor (SANY 02, 13/11/2026). El
 * supervisor cambia el estado como antes: no puede cerrar tarjetas ajenas.
 *
 * Devuelve `modal`, que el llamador tiene que dibujar. `cambiar` dice si
 * abrió la ventana (`'ventana'`), para que una hoja o un menú se cierre antes
 * de que dos diálogos se peleen el foco.
 */
export function useCambiarEstadoEquipo(): {
  cambiar: (
    equipo: Equipment,
    status: EquipmentStatus,
    opciones?: { onSuccess?: () => void },
  ) => 'ventana' | 'directo';
  modal: ReactNode;
  isPending: boolean;
} {
  const { role } = useCurrentUser();
  const updateStatus = useUpdateEquipmentStatus();
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const cambiar = (
    equipo: Equipment,
    status: EquipmentStatus,
    opciones?: { onSuccess?: () => void },
  ): 'ventana' | 'directo' => {
    const { openShift } = equipo;
    if (role === ROLES.ADMIN && status !== 'OPERATIONAL' && openShift != null) {
      setPendiente({ equipo: { ...equipo, openShift }, status, onSuccess: opciones?.onSuccess });
      return 'ventana';
    }
    updateStatus.mutate({ equipo, status }, opciones?.onSuccess ? { onSuccess: opciones.onSuccess } : undefined);
    return 'directo';
  };

  const modal = pendiente ? (
    <CerrarUsoModal
      equipo={pendiente.equipo}
      nuevoEstado={pendiente.status}
      onClose={() => setPendiente(null)}
      onHecho={pendiente.onSuccess}
    />
  ) : null;

  return { cambiar, modal, isPending: updateStatus.isPending };
}
