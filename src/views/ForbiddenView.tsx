import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@heroui/react';

import { homePathFor } from '../config/home-path';
import { useCurrentUser } from '../hooks/useCurrentUser';

/**
 * Vista mostrada cuando `ProtectedRoute` deniega el acceso por rol. Vuelve a
 * `homePathFor(role)` (no a `/` fijo): con roles por-rol (ver `config/
 * home-path.ts`) un `/` hardcodeado podría rebotar de nuevo a un rol al que
 * `/` no le corresponde.
 */
export function ForbiddenView() {
  const navigate = useNavigate();
  const { role } = useCurrentUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <Card.Header>
          <Card.Title>Sin permiso</Card.Title>
          <Card.Description>Tu rol no tiene acceso a esta sección.</Card.Description>
        </Card.Header>
        <Card.Footer className="justify-center">
          <Button onPress={() => navigate(homePathFor(role))}>Volver al inicio</Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
