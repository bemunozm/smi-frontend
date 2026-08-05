import { createBrowserRouter } from 'react-router';
import { AppLayout } from './layout/AppLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <p className="text-muted-foreground">Elegí una sección en el menú.</p>,
      },
    ],
  },
]);
