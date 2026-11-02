import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import './index.css';
import { AppProviders } from './context/AppProviders';
import { startSignOutRevocation } from './lib/server-signout';
import { instalarReboteAtras } from './pwa/back-trap';
import { capturarInvitacionInstalar } from './pwa/install-prompt';
import { router } from './routes';

startSignOutRevocation();
// Antes de montar React: Chrome puede avisar muy temprano que la app es
// instalable y ese aviso no se repite (ver `pwa/install-prompt.ts`).
capturarInvitacionInstalar();
// Después de importar `router`: su `replaceState` inicial fija el `idx: 0`
// del que depende el rebote (ver `pwa/back-trap.ts`).
instalarReboteAtras();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
