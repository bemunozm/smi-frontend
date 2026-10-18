import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from '@heroui/react';

import { RESPONSIVE_SHEET_DIALOG_CLASS } from '../flota/modal-styles';

interface KpiDetailModalProps {
  /** Espeja el label de la card que lo abre. */
  title: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Vista completa: destino de «Ver todo →». */
  verTodoTo: string;
  children: ReactNode;
}

/**
 * Popup de detalle de una KPI card del dashboard. Mismo patrón `Modal.Backdrop`
 * controlado que el resto de los modales de admin (foco atrapado, Esc, click en
 * el overlay y botón de cierre vienen de HeroUI/react-aria). El pie lleva la
 * navegación a la vista completa.
 */
export function KpiDetailModal({ title, isOpen, onOpenChange, verTodoTo, children }: KpiDetailModalProps) {
  const navigate = useNavigate();
  return (
    <Modal.Backdrop isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>{children}</Modal.Body>
          <Modal.Footer>
            <Button
              onPress={() => {
                onOpenChange(false);
                void navigate(verTodoTo);
              }}
              variant="secondary"
            >
              Ver todo →
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
