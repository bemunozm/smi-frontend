import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@heroui/react';

/** Vista mostrada cuando `ProtectedRoute` deniega el acceso por rol. */
export function ForbiddenView() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <Card.Header>
          <Card.Title>Sin permiso</Card.Title>
          <Card.Description>Tu rol no tiene acceso a esta sección.</Card.Description>
        </Card.Header>
        <Card.Footer className="justify-center">
          <Button onPress={() => navigate('/')}>Volver al dashboard</Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
