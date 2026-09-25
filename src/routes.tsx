import { createBrowserRouter, Navigate } from 'react-router-dom';

import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ROLES } from './types/roles';
import { AppLayout } from './layout/AppLayout';
import { DashboardView } from './views/DashboardView';
import { EquipoDetalleView } from './views/EquipoDetalleView';
import { EquiposView } from './views/EquiposView';
import { FichaEquipoView } from './views/FichaEquipoView';
import { ForbiddenView } from './views/ForbiddenView';
import { FichaItemView } from './views/FichaItemView';
import { InventarioView } from './views/InventarioView';
import { MovimientosView } from './views/MovimientosView';
import { LoginView } from './views/LoginView';
import { MantenimientoView } from './views/MantenimientoView';
import { NotificacionesView } from './views/NotificacionesView';
import { PlaceholderView } from './views/PlaceholderView';
import { ProfileView } from './views/ProfileView';
import { UsersView } from './views/UsersView';
import { TerrenoLayout } from './layout/TerrenoLayout';
import { CombustibleView } from './views/CombustibleView';
import { HorometroView } from './views/HorometroView';
import { TrabajosExtraView } from './views/TrabajosExtraView';
import { HallazgosView } from './views/HallazgosView';
import { ReporteDiarioView } from './views/ReporteDiarioView';
import { RegistroEquipoView } from './views/RegistroEquipoView';

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
          // Notificaciones es universal (todos los roles autenticados): solo
          // exige estar dentro de `ProtectedRoute`, sin `allowedRoles`.
          { path: '/notificaciones', element: <NotificacionesView /> },
          // Flota + Inventario (Amin). La LECTURA la comparten los roles que
          // necesitan consultar equipos y stock: Terreno para saber qué máquina
          // opera, Taller para saber si hay repuesto. La escritura la restringe
          // el backend por endpoint (@Roles), y la UI oculta las acciones que
          // el rol no puede ejecutar.
          {
            element: (
              <ProtectedRoute
                allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR]}
              />
            ),
            children: [
              { path: '/equipos', element: <EquiposView /> },
              { path: '/equipos/:id', element: <EquipoDetalleView /> },
              { path: '/equipos/:id/ficha', element: <FichaEquipoView /> },
              { path: '/inventario', element: <InventarioView /> },
              // Antes que `:id`: si no, "movimientos" se leería como el id de
              // un ítem y la pantalla pediría un kardex que no existe.
              { path: '/inventario/movimientos', element: <MovimientosView /> },
              { path: '/inventario/:id', element: <FichaItemView /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
            children: [
              { path: '/reportes', element: <PlaceholderView title="Reportes" /> },
              { path: '/usuarios', element: <UsersView /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANTENEDOR]} />,
            children: [{ path: '/mantenimiento', element: <MantenimientoView /> }],
          },
        ],
      },
      // Operación en Terreno — shell propio (fuera del layout de escritorio),
      // restringido a ADMIN + SUPERVISOR. Se integra con la auth/rutas del
      // equipo; su header + navegación reemplazan al Sidebar/Topbar. Nació
      // solo para teléfono; desde T46 también se usa en tablet y PC.
      {
        element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]} />,
        children: [
          {
            element: <TerrenoLayout />,
            children: [
              { path: '/terreno', element: <Navigate replace to="/terreno/registro" /> },
              // Los cuatro destinos del módulo, en el orden de la maqueta.
              // `registro` y `reporte-diario` son los módulos A y B de la espec
              // del 21/09: maquetas sin backend todavía — ver la cabecera de
              // cada vista.
              { path: '/terreno/registro', element: <RegistroEquipoView /> },
              { path: '/terreno/reporte-diario', element: <ReporteDiarioView /> },
              { path: '/terreno/trabajos-extra', element: <TrabajosExtraView /> },
              { path: '/terreno/hallazgos', element: <HallazgosView /> },
              // Combustible y Horómetro salieron de la navegación: la espec las
              // fusiona en «Registro de equipo». Las rutas siguen vivas porque
              // son las únicas dos con backend real, y de ahí hay que sacar los
              // endpoints cuando el Módulo A deje de ser maqueta. Se borran
              // recién entonces.
              { path: '/terreno/combustible', element: <CombustibleView /> },
              { path: '/terreno/horometro', element: <HorometroView /> },
            ],
          },
        ],
      },
    ],
  },
]);
