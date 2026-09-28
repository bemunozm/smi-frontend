import { createBrowserRouter, Navigate } from 'react-router-dom';

import { GuestRoute } from './components/GuestRoute';
import { HomeRedirect } from './components/HomeRedirect';
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
import { OperadoresView } from './views/OperadoresView';
import { PlaceholderView } from './views/PlaceholderView';
import { ProfileView } from './views/ProfileView';
import { SinModulosView } from './views/SinModulosView';
import { UsersView } from './views/UsersView';
import { TerrenoLayout } from './layout/TerrenoLayout';
import { CombustibleView } from './views/CombustibleView';
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
      // `/inicio` reparte por rol (`HomeRedirect`) — destino de `LoginView`,
      // `GuestRoute` y el `start_url` del manifest PWA (ver
      // `config/home-path.ts`). Vive directo bajo el `ProtectedRoute` de
      // arriba (cualquier sesión válida, sin `allowedRoles`): no necesita el
      // chrome de `AppLayout`, solo decide y navega.
      { path: '/inicio', element: <HomeRedirect /> },
      // Home de OPERADOR (hoy sin módulo propio) — mismo criterio que
      // `/inicio`, universal a cualquier sesión autenticada.
      { path: '/sin-modulos', element: <SinModulosView /> },
      {
        element: <AppLayout />,
        children: [
          // `/` NO reparte por rol a propósito (ver `config/home-path.ts` y
          // el drawer de Terreno, que linkea acá con "Ir al panel") — pero
          // OPERADOR no tiene Dashboard ni pantallas de datos, así que queda
          // detrás de su propio `allowedRoles`, igual que Equipos/Inventario.
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR]} />,
            children: [{ path: '/', element: <DashboardView /> }],
          },
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
          // Catálogo de Operadores (Supervisión en Terreno) — lectura y
          // escritura para ADMIN/SUPERVISOR (el borrado, ADMIN-only, lo
          // restringe el backend; la UI ya oculta la acción, ver
          // `OperadoresView`).
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]} />,
            children: [{ path: '/operadores', element: <OperadoresView /> }],
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
              // Combustible sigue viva sin estar enlazada (la espec la fusiona
              // en «Registro de equipo»): tiene backend real y de ahí hay que
              // sacar los endpoints cuando el Módulo A deje de ser maqueta.
              // Horómetro (la otra mitad del flujo viejo) ya se borró — ver
              // `views/HorometroView.tsx` en el historial de git.
              { path: '/terreno/combustible', element: <CombustibleView /> },
            ],
          },
        ],
      },
    ],
  },
]);
