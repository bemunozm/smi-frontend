import { Outlet } from 'react-router-dom';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Shell del área protegida: sidebar (menú por rol) + topbar (usuario/logout)
 * + contenido de la ruta activa vía `<Outlet />`.
 */
export function AppLayout() {
  const { role } = useCurrentUser();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
