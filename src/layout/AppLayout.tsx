import { Outlet } from 'react-router-dom';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Shell del área protegida: sidebar (menú por rol) + topbar (usuario/logout)
 * + contenido de la ruta activa vía `<Outlet />`.
 *
 * Desde `lg` la navegación es el sidebar; debajo es la barra inferior, y el
 * sidebar queda como cajón detrás de «Más». No se muestran los dos a la vez:
 * en tablet eso dejaba 256 px de menú fijo compitiendo con el contenido.
 */
export function AppLayout() {
  const { role } = useCurrentUser();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
        <BottomNav role={role} />
      </div>
    </div>
  );
}
