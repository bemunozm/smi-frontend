import { createBrowserRouter, Navigate } from 'react-router-dom';

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
import { TerrenoMobileLayout } from './layout/TerrenoLayout';
import { CombustibleView } from './views/CombustibleView';
import { HorometroView } from './views/HorometroView';
import { TrabajosExtraView } from './views/TrabajosExtraView';
import { HallazgosView } from './views/HallazgosView';

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
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANTENEDOR]} />,
            children: [
              { path: '/mantenimiento', element: <PlaceholderView title="Mantenimiento" /> },
            ],
          },
        ],
      },
      // Operación en Terreno — UI mobile propia (fuera del layout desktop),
      // restringida a ADMIN + SUPERVISOR. Se integra con la auth/rutas del
      // equipo; el shell mobile (header + tab bar) reemplaza al Sidebar/Topbar.
      {
        element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]} />,
        children: [
          {
            element: <TerrenoMobileLayout />,
            children: [
              { path: '/terreno', element: <Navigate replace to="/terreno/hallazgos" /> },
              { path: '/terreno/combustible', element: <CombustibleView /> },
              { path: '/terreno/horometro', element: <HorometroView /> },
              { path: '/terreno/trabajos-extra', element: <TrabajosExtraView /> },
              { path: '/terreno/hallazgos', element: <HallazgosView /> },
            ],
          },
        ],
      },
    ],
  },
]);
