import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { CombustiblePage } from '../modules/terreno/combustible/CombustiblePage';
import { HorometroPage } from '../modules/terreno/horometro/HorometroPage';
import { TrabajosExtraPage } from '../modules/terreno/trabajos-extra/TrabajosExtraPage';
import { HallazgosPage } from '../modules/terreno/hallazgos/HallazgosPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/terreno/hallazgos" replace /> },
      { path: 'terreno/combustible', element: <CombustiblePage /> },
      { path: 'terreno/horometro', element: <HorometroPage /> },
      { path: 'terreno/trabajos-extra', element: <TrabajosExtraPage /> },
      { path: 'terreno/hallazgos', element: <HallazgosPage /> },
    ],
  },
]);
