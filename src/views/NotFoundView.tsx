import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@heroui/react';

import { homePathFor } from '../config/home-path';
import { useCurrentUser } from '../hooks/useCurrentUser';

/**
 * Una dirección que no existe (un enlace viejo, una pestaña que quedó abierta
 * en una ruta que se movió). Sin esto el router mostraba su pantalla técnica
 * «Unexpected Application Error! 404 Not Found». Vuelve al inicio del rol,
 * igual que `ForbiddenView`.
 */
export function NotFoundView() {
  const navigate = useNavigate();
  const { role } = useCurrentUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <Card.Header>
          <Card.Title>Página no encontrada</Card.Title>
          <Card.Description>
            Esta dirección no existe o se movió. Vuelve al inicio y entra desde el menú.
          </Card.Description>
        </Card.Header>
        <Card.Footer className="justify-center">
          <Button onPress={() => navigate(homePathFor(role))}>Volver al inicio</Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
