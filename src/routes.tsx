import { createBrowserRouter } from 'react-router-dom';

import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ROLES } from './types/roles';
import { AppLayout } from './layout/AppLayout';
import { DashboardView } from './views/DashboardView';
import { ForbiddenView } from './views/ForbiddenView';
import { LoginView } from './views/LoginView';
import { PlaceholderView } from './views/PlaceholderView';
import { ProfileView } from './views/ProfileView';
import { UsersView } from './views/UsersView';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: '/login', element: <LoginView /> }],
  },
  { path: '/forbidden', element: <ForbiddenView /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardView /> },
          { path: '/perfil', element: <ProfileView /> },
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
            children: [
              { path: '/equipos', element: <PlaceholderView title="Equipos" /> },
              { path: '/inventario', element: <PlaceholderView title="Inventario" /> },
              { path: '/notificaciones', element: <PlaceholderView title="Notificaciones" /> },
              { path: '/reportes', element: <PlaceholderView title="Reportes" /> },
              { path: '/usuarios', element: <UsersView /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]} />,
            children: [{ path: '/terreno', element: <PlaceholderView title="Terreno" /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANTENEDOR]} />,
            children: [
              { path: '/mantenimiento', element: <PlaceholderView title="Mantenimiento" /> },
            ],
          },
        ],
      },
    ],
  },
]);
