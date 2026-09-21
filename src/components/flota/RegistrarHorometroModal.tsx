import { useRef, useState } from 'react';

import type { Equipment } from '../../types/equipment';
import { RegistrarEntradaModal } from './RegistrarEntradaModal';
import { RegistrarSalidaModal } from './RegistrarSalidaModal';

type EquipoParaHorometro = Pick<Equipment, 'id' | 'internalCode' | 'controlUnit' | 'openShift'>;

/** Label del botón/tile que abre `RegistrarHorometroModal` — "Registrar
 * entrada" sin turno abierto, "Registrar salida" con uno en curso. Fuente
 * única para el botón del header (`EquipoDetalleView`) y el tile de la hoja
 * de acciones móvil (`EquipoCardMobile` en `EquiposView`), antes duplicado
 * entre ambos (Fix F-MEDIA #2, review adversarial). */
export function registrarHorometroLabel(equipo: Pick<Equipment, 'openShift'>): string {
  return equipo.openShift == null ? 'Registrar entrada' : 'Registrar salida';
}

interface RegistrarHorometroModalProps {
  equipo: EquipoParaHorometro;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Wrapper único que decide entre `RegistrarEntradaModal`/`RegistrarSalidaModal`
 * según `equipo.openShift` — antes esa misma decisión (y su label, ver
 * `registrarHorometroLabel`) vivía 4× repartida entre `EquipoDetalleView`
 * (botón del header + selección de modal) y `EquiposView`→`EquipoCardMobile`
 * (label del tile + selección de modal).
 *
 * `openShift` se CONGELA mientras el modal permanece abierto: este wrapper
 * queda montado de forma continua (mismo patrón "controlado" que el resto de
 * los modales de Flota), así que si se resolviera leyendo `equipo.openShift`
 * en vivo en cada render, una invalidación de `['equipment']` mientras el
 * modal está abierto (p. ej. porque el mismo turno se cerró desde otra
 * pestaña) intercambiaría `RegistrarSalidaModal` por `RegistrarEntradaModal`
 * DEBAJO del usuario, perdiendo el formulario en curso.
 *
 * La congelación se re-evalúa en cada transición cerrado→abierto (no solo en
 * el montaje inicial del wrapper, que puede ocurrir mucho antes de que el
 * usuario abra el modal por primera vez): así cada apertura arranca con el
 * `openShift` más reciente, y solo se ignoran los refetches que llegan
 * MIENTRAS está abierto — "ajustar estado durante el render" (sin `useEffect`
 * ni remount), para no perder la transición de apertura/cierre del modal.
 */
export function RegistrarHorometroModal({ equipo, isOpen, onOpenChange }: RegistrarHorometroModalProps) {
  const [openShiftCongelado, setOpenShiftCongelado] = useState(equipo.openShift);
  const isOpenPrevRef = useRef(isOpen);

  if (isOpen !== isOpenPrevRef.current) {
    isOpenPrevRef.current = isOpen;
    if (isOpen) setOpenShiftCongelado(equipo.openShift);
  }

  if (openShiftCongelado == null) {
    return (
      <RegistrarEntradaModal
        controlUnit={equipo.controlUnit}
        equipoId={equipo.id}
        equipoLabel={equipo.internalCode}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      />
    );
  }

  return (
    <RegistrarSalidaModal
      controlUnit={equipo.controlUnit}
      equipoLabel={equipo.internalCode}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      openShift={openShiftCongelado}
    />
  );
}
