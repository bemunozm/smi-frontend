import { AlertDialog, Button } from '@heroui/react';

/**
 * «¿Descartar el informe?»: la X de una hoja de informe con algo escrito.
 * Cerrar la hoja bota todo lo llenado (lecturas, litros, fotos, personal), así
 * que se pregunta antes. Lo usan el cierre con informe y «Subir informe antiguo».
 */
export function ConfirmarDescarte({
  abierto,
  onSeguir,
  onDescartar,
}: {
  abierto: boolean;
  onSeguir: () => void;
  onDescartar: () => void;
}) {
  return (
    <AlertDialog.Backdrop
      isOpen={abierto}
      onOpenChange={(open) => {
        if (!open) onSeguir();
      }}
      className="z-[60]"
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>¿Descartar el informe?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>Se perderá lo que llenaste.</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onSeguir}>
              Seguir llenando
            </Button>
            <Button variant="danger" onPress={onDescartar}>
              Descartar
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
