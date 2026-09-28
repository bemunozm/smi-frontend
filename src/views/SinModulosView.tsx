import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@heroui/react';

import { logout } from '../lib/logout';

/**
 * Home del rol OPERADOR (`homePathFor`, ruta `/sin-modulos`) — hoy no tiene
 * ningún módulo propio en el frontend (ver plan "Supervisión en Terreno",
 * sección "Diseño → Roles"): a propósito NO lo manda al Dashboard ni a
 * ninguna pantalla de datos de Flota/Mantención, que no le corresponden.
 * Única acción disponible: cerrar sesión.
 */
export function SinModulosView() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <Card.Header>
          <Card.Title>Sin módulos asignados</Card.Title>
          <Card.Description>Tu usuario todavía no tiene módulos asignados.</Card.Description>
        </Card.Header>
        <Card.Footer className="justify-center">
          <Button variant="secondary" onPress={() => void logout(navigate)}>
            Cerrar sesión
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
