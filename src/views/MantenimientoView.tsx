import { Tabs } from '@heroui/react';

import { ActividadesView } from './ActividadesView';
import { BitacoraView } from './BitacoraView';
import { OrdenesTrabajoView } from './OrdenesTrabajoView';
import { PreventivoView } from './PreventivoView';

/**
 * Contenedor del dominio Mantenimiento: 4 pestañas (Órdenes / Bitácora /
 * Preventivo / Tareas), cada una una sub-vista independiente en su propio
 * archivo con sus propios hooks (`useOrdenes`, `useIntervenciones`,
 * `useUmbrales`, `useActividades`). `Tabs` no controlado
 * (`defaultSelectedKey`) — no hay necesidad de sincronizar la pestaña activa
 * con la URL todavía.
 */
export function MantenimientoView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Mantenimiento
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Mantenimiento
        </h1>
        <p className="text-sm text-muted">
          Órdenes de trabajo, bitácora de intervenciones, plan preventivo y actividades del equipo.
        </p>
      </div>

      <Tabs defaultSelectedKey="ordenes">
        <Tabs.List aria-label="Secciones de Mantenimiento">
          <Tabs.Tab id="ordenes">Órdenes</Tabs.Tab>
          <Tabs.Tab id="bitacora">Bitácora</Tabs.Tab>
          <Tabs.Tab id="preventivo">Preventivo</Tabs.Tab>
          <Tabs.Tab id="tareas">Tareas</Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Panel id="ordenes">
          <OrdenesTrabajoView />
        </Tabs.Panel>
        <Tabs.Panel id="bitacora">
          <BitacoraView />
        </Tabs.Panel>
        <Tabs.Panel id="preventivo">
          <PreventivoView />
        </Tabs.Panel>
        <Tabs.Panel id="tareas">
          <ActividadesView />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
