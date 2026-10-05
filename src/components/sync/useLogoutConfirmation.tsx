import { useState, type ReactNode } from 'react';
import { AlertDialog, Button, Spinner, toast } from '@heroui/react';

import { plural } from '../../lib/format';
import { logout } from '../../lib/logout';
import { logger } from '../../lib/logger';
import { countPending } from '../../offline/outbox';

type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

const LOGOUT_ERROR_MESSAGE = 'No se pudo cerrar la sesión. Revisá la conexión e intentá de nuevo.';

export interface LogoutConfirmation {
  /** Pide cerrar sesión: si hay registros sin enviar abre la confirmación, si no cierra directo. */
  requestLogout: () => void;
  /** El diálogo de confirmación — se renderiza una vez, junto al botón que lo usa. */
  confirmationDialog: ReactNode;
}

/**
 * "Cerrar sesión" con la cola de registros sin enviar a la vista. Se puede salir
 * con registros pendientes —quien termina el turno sin señal no puede esperar—, pero
 * antes se le dice cuántos quedan y qué pasa con ellos: siguen en el equipo y se
 * envían cuando vuelva a iniciar sesión (`lib/logout.ts`).
 *
 * Lo comparten el menú de usuario de oficina y el drawer de Terreno; cada uno
 * pasa su `navigate`.
 */
export function useLogoutConfirmation(userId: string | undefined, navigate: NavigateFn): LogoutConfirmation {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const signOutNow = async (): Promise<boolean> => {
    setSigningOut(true);
    try {
      await logout(navigate);
      return true;
    } catch (error) {
      logger.error('No se pudo cerrar la sesión.', error);
      toast.danger(LOGOUT_ERROR_MESSAGE);
      return false;
    } finally {
      setSigningOut(false);
    }
  };

  const requestLogout = (): void => {
    void (async () => {
      const count = userId ? await countPending(userId) : 0;
      if (count > 0) setPendingCount(count);
      else await signOutNow();
    })();
  };

  const confirmationDialog = (
    <AlertDialog.Backdrop
      isOpen={pendingCount !== null}
      onOpenChange={(open) => {
        if (!open) setPendingCount(null);
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>¿Cerrar sesión?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Hay {plural(pendingCount ?? 0, 'registro', 'registros')} sin enviar; se enviarán cuando vuelvas a
                  iniciar sesión en este equipo.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isPending={signingOut}
                  variant="danger"
                  onPress={() => {
                    void signOutNow().then((ok) => {
                      if (ok) close();
                    });
                  }}
                >
                  {signingOut ? <Spinner color="current" size="sm" /> : 'Cerrar sesión'}
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );

  return { requestLogout, confirmationDialog };
}
