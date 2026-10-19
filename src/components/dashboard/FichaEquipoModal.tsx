import { useNavigate } from 'react-router-dom';
import { Button, Modal } from '@heroui/react';

import { EquipoDetalleView } from '../../views/EquipoDetalleView';

/**
 * Más ancho que `RESPONSIVE_SHEET_DIALOG_WIDE_CLASS` (768px): la ficha es una
 * página completa con cuerpo a 2 columnas en `lg:`, así que el diálogo sube a
 * `max-w-6xl` (1152px) — vista pensada para computador. En celular sigue como
 * hoja a pantalla completa, mismo criterio que el resto de los sheets.
 */
const FICHA_DIALOG_CLASS =
  'flex h-full max-h-full w-full max-w-full flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-6xl sm:rounded-2xl';

/**
 * Popup con la ficha completa del equipo (la MISMA `EquipoDetalleView` de
 * `/equipos/:id`, montada con `equipoId`/`enModal`): las tarjetas de flota del
 * dashboard la abren acá en vez de navegar (pedido del administrador). El pie
 * deja el escape a la página completa para quien quiera la URL.
 */
export function FichaEquipoModal({ equipoId, onClose }: { equipoId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal.Backdrop
      isDismissable
      isOpen={equipoId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={FICHA_DIALOG_CLASS}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Ficha del equipo
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>{equipoId ? <EquipoDetalleView enModal equipoId={equipoId} /> : null}</Modal.Body>
          <Modal.Footer>
            <Button
              onPress={() => {
                onClose();
                if (equipoId) void navigate(`/equipos/${equipoId}`, { state: { from: '/' } });
              }}
              variant="secondary"
            >
              Abrir en página completa →
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
