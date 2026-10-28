import { createBrowserRouter, Navigate } from 'react-router-dom';

import { GuestRoute } from './components/GuestRoute';
import { HomeRedirect } from './components/HomeRedirect';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PushResubscribeMount } from './components/push/PushResubscribeMount';
import { SyncEngineMount } from './components/SyncEngineMount';
import { ROLES } from './types/roles';
import { AppLayout } from './layout/AppLayout';
import { DashboardView } from './views/DashboardView';
import { EquipoDetalleView } from './views/EquipoDetalleView';
import { EquiposView } from './views/EquiposView';
import { FichaEquipoView } from './views/FichaEquipoView';
import { ForbiddenView } from './views/ForbiddenView';
import { NotFoundView } from './views/NotFoundView';
import { FichaItemView } from './views/FichaItemView';
import { InventarioView } from './views/InventarioView';
import { MovimientosView } from './views/MovimientosView';
import { LoginView } from './views/LoginView';
import { ChecklistDiarioView } from './views/ChecklistDiarioView';
import { MantenimientoLayout } from './layout/MantenimientoLayout';
import { OrdenesTrabajoView } from './views/OrdenesTrabajoView';
import { MiCamionetaView } from './views/MiCamionetaView';
import { WorkshopStockView } from './views/WorkshopStockView';
import { NotificacionesView } from './views/NotificacionesView';
import { OperadoresView } from './views/OperadoresView';
import { ProfileView } from './views/ProfileView';
import { UsersView } from './views/UsersView';
import { TerrenoLayout } from './layout/TerrenoLayout';
import { CombustibleView } from './views/CombustibleView';
import { TrabajosExtraView } from './views/TrabajosExtraView';
import { HallazgosView } from './views/HallazgosView';
import { HallazgosAdminView } from './views/HallazgosAdminView';
import { TrabajosExtraAdminView } from './views/TrabajosExtraAdminView';
import { MantencionesAdminView } from './views/MantencionesAdminView';
import { ReportesDiariosAdminView } from './views/ReportesDiariosAdminView';
import { ReportesView } from './views/ReportesView';
import { ValidarChecklistsView } from './views/ValidarChecklistsView';
import { VencimientosView } from './views/VencimientosView';
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
        // `SyncEngineMount` (sin UI) monta el motor de sync a nivel de
        // SESIÓN — directo bajo el `ProtectedRoute` de arriba (cualquier
        // sesión válida, sin `allowedRoles`), ancestro TANTO de `AppLayout`
        // como de `TerrenoLayout` más abajo: así los disparadores del motor
        // (`online`, `visibilitychange`, los 45 s) no se cortan al navegar
        // entre "Ir al panel" (`/`) y Terreno. Ver ese componente.
        element: <SyncEngineMount />,
        children: [
          {
            // `PushResubscribeMount` (sin UI), también a nivel de sesión:
            // resuscribe el Web Push del dispositivo al confirmar sesión si
            // este usuario ya lo había activado acá (la contraparte del
            // logout, que desuscribe). Ver ese componente.
            element: <PushResubscribeMount />,
            children: [
          // `/inicio` reparte por rol (`HomeRedirect`) — destino de
          // `LoginView`, `GuestRoute` y el `start_url` del manifest PWA (ver
          // `config/home-path.ts`). No necesita el chrome de `AppLayout`,
          // solo decide y navega.
          { path: '/inicio', element: <HomeRedirect /> },
          {
            element: <AppLayout />,
            children: [
              // `/` NO reparte por rol a propósito (ver `config/home-path.ts`
              // y el drawer de Terreno, que linkea acá con "Ir al panel") —
              // sigue detrás de su propio `allowedRoles`, igual que
              // Equipos/Inventario.
              {
                element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
                children: [{ path: '/', element: <DashboardView /> }],
              },
              { path: '/perfil', element: <ProfileView /> },
              // Notificaciones es universal (todos los roles autenticados):
              // solo exige estar dentro de `ProtectedRoute`, sin `allowedRoles`.
              { path: '/notificaciones', element: <NotificacionesView /> },
              // Flota + Inventario (Amin). La LECTURA la comparten los roles
              // que necesitan consultar equipos y stock: Terreno para saber
              // qué máquina opera, Taller para saber si hay repuesto. La
              // escritura la restringe el backend por endpoint (@Roles), y la
              // UI oculta las acciones que el rol no puede ejecutar.
              {
                element: (
                  <ProtectedRoute
                    allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR]}
                  />
                ),
                children: [
                  { path: '/equipos', element: <EquiposView /> },
                  // El calendario estuvo un tiempo en `/vencimientos` (menú propio):
                  // un enlace o pestaña vieja llega a su lugar nuevo.
                  { path: '/vencimientos', element: <Navigate replace to="/equipos/vencimientos" /> },
                  // Módulo 4: el calendario de vencimientos de los livianos vive
                  // dentro de Equipos (botón en la lista y tarjeta en cada
                  // ficha), no como módulo aparte. Lo ven quienes reciben los
                  // avisos. Antes que `:id`, que lo leería como un id.
                  {
                    element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANTENEDOR]} />,
                    children: [{ path: '/equipos/vencimientos', element: <VencimientosView /> }],
                  },
                  { path: '/equipos/:id', element: <EquipoDetalleView /> },
                  { path: '/equipos/:id/ficha', element: <FichaEquipoView /> },
                  { path: '/inventario', element: <InventarioView /> },
                  // Antes que `:id`: si no, "movimientos" se leería como el id
                  // de un ítem y la pantalla pediría un kardex que no existe.
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
                  // Gestión de hallazgos del administrador (ver/corregir/eliminar);
                  // Terreno conserva su propia vista en /terreno/hallazgos.
                  { path: '/hallazgos', element: <HallazgosAdminView /> },
                  // Trabajos extraordinarios del administrador (solo lectura,
                  // con filtros); Terreno conserva /terreno/trabajos-extra.
                  { path: '/trabajos-extra', element: <TrabajosExtraAdminView /> },
                  // Reportes diarios de los supervisores (solo lectura, con
                  // filtros); Terreno conserva /terreno/reporte-diario.
                  { path: '/reportes-diarios', element: <ReportesDiariosAdminView /> },
                  // Registro de mantenciones completadas del taller (solo
                  // lectura, con filtros y detalle); destino del aviso
                  // «Orden de trabajo completada» del administrador.
                  { path: '/mantenciones', element: <MantencionesAdminView /> },
                  // Registro de reportes de salida de turno de los
                  // supervisores, con descarga del PDF.
                  { path: '/reportes', element: <ReportesView /> },
                  { path: '/usuarios', element: <UsersView /> },
                ],
              },
            ],
          },
          // Mantención (el taller) — shell propio igual que Terreno: al entrar
          // desaparece el chrome del administrador y manda la navegación del
          // módulo (ver `layout/MantenimientoLayout.tsx`): Órdenes, Checklist,
          // Stock y Equipos.
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANTENEDOR]} />,
            children: [
              {
                element: <MantenimientoLayout />,
                children: [
                  { path: '/mantenimiento', element: <Navigate replace to="/mantenimiento/ordenes" /> },
                  { path: '/mantenimiento/ordenes', element: <OrdenesTrabajoView /> },
                  { path: '/mantenimiento/checklist', element: <ChecklistDiarioView /> },
                  // La camioneta con que el mantenedor se mueve en faena (km y carga de combustible).
                  { path: '/mantenimiento/camioneta', element: <MiCamionetaView /> },
                  { path: '/mantenimiento/stock', element: <WorkshopStockView /> },
                  // Historial y ficha SIN salir del taller: las mismas
                  // pantallas de Inventario, montadas acá para que la barra
                  // del módulo no cambie (la pestaña Stock sigue activa).
                  // "movimientos" antes que `:id`, igual que en Inventario.
                  {
                    path: '/mantenimiento/stock/movimientos',
                    element: <MovimientosView contexto="taller" />,
                  },
                  {
                    path: '/mantenimiento/stock/:id',
                    element: <FichaItemView contexto="taller" />,
                  },
                  // Equipos de consulta para el taller: lista, detalle y
                  // bitácora consolidada en SOLO LECTURA (el contexto apaga
                  // todas las escrituras, sin mirar el rol), dentro del shell.
                  { path: '/mantenimiento/equipos', element: <EquiposView contexto="taller" /> },
                  // Módulo 4: el mismo calendario, dentro del taller (se entra
                  // desde Equipos; la barra mantiene sus cuatro secciones).
                  {
                    path: '/mantenimiento/vencimientos',
                    element: <VencimientosView contexto="taller" />,
                  },
                  {
                    path: '/mantenimiento/equipos/:id',
                    element: <EquipoDetalleView contexto="taller" />,
                  },
                  {
                    path: '/mantenimiento/equipos/:id/ficha',
                    element: <FichaEquipoView contexto="taller" />,
                  },
                ],
              },
            ],
          },
          // Operación en Terreno — shell propio (fuera del layout de
          // escritorio), restringido a ADMIN + SUPERVISOR. Se integra con la
          // auth/rutas del equipo; su header + navegación reemplazan al
          // Sidebar/Topbar. Nació solo para teléfono; desde T46 también se
          // usa en tablet y PC. Vive DENTRO de `SyncEngineMount` (no como
          // sibling suyo bajo el `ProtectedRoute` de arriba): es justo el
          // árbol al que un SUPERVISOR entra y sale con el motor corriendo
          // de fondo.
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]} />,
            children: [
              {
                element: <TerrenoLayout />,
                children: [
                  { path: '/terreno', element: <Navigate replace to="/terreno/registro" /> },
                  // Los cuatro destinos del módulo, en el orden de la
                  // maqueta. `reporte-diario` es el Módulo B (reporte del
                  // supervisor, con backend y cola offline) — ver su vista.
                  { path: '/terreno/registro', element: <RegistroEquipoView /> },
                  { path: '/terreno/reporte-diario', element: <ReporteDiarioView /> },
                  { path: '/terreno/trabajos-extra', element: <TrabajosExtraView /> },
                  { path: '/terreno/hallazgos', element: <HallazgosView /> },
                  { path: '/terreno/checklists', element: <ValidarChecklistsView /> },
                  // Combustible sigue viva sin estar enlazada (la espec la
                  // fusiona en «Registro de equipo»): tiene backend real y de
                  // ahí hay que sacar los endpoints cuando el Módulo A deje
                  // de ser maqueta. Horómetro (la otra mitad del flujo viejo)
                  // ya se borró — ver `views/HorometroView.tsx` en el
                  // historial de git.
                  { path: '/terreno/combustible', element: <CombustibleView /> },
                ],
              },
            ],
          },
            ],
          },
        ],
      },
    ],
  },
  // Cualquier otra dirección: página «No encontrada» en vez del error técnico
  // del router.
  { path: '*', element: <NotFoundView /> },
]);
