import { useState } from 'react';
import { Tabs } from '@heroui/react';
import type { Key } from '@heroui/react';
import { ClipboardList, Gauge, ListChecks, Package } from 'lucide-react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { ROLES } from '../types/roles';
import { ActividadesView } from './ActividadesView';
import { OrdenesTrabajoView } from './OrdenesTrabajoView';
import { PreventivoView } from './PreventivoView';
import { WorkshopStockView } from './WorkshopStockView';

/**
 * Secciones del dominio. Única fuente para el control superior (desktop) y
 * la barra inferior (móvil), así label/orden no se desincronizan.
 * Órdenes y Stock son el taller del diseño "Mantenedor Taller" (la creación
 * tipo Bitácora vive dentro de "Crear orden" en el tablero); Preventivo y
 * Tareas son gestión que el diseño no cubre y quedan solo para ADMIN.
 */
const SECTIONS = [
  { id: 'ordenes', label: 'Órdenes', icon: ClipboardList, adminOnly: false },
  { id: 'stock', label: 'Stock', icon: Package, adminOnly: false },
  { id: 'preventivo', label: 'Preventivo', icon: Gauge, adminOnly: true },
  { id: 'tareas', label: 'Tareas', icon: ListChecks, adminOnly: true },
] as const;

const PANELS: Record<(typeof SECTIONS)[number]['id'], () => React.ReactNode> = {
  ordenes: () => <OrdenesTrabajoView />,
  stock: () => <WorkshopStockView />,
  preventivo: () => <PreventivoView />,
  tareas: () => <ActividadesView />,
};

// Estilo de cada pestaña del segmented control (desktop). Estados vía
// data-attrs de react-aria (`data-selected`/`data-hovered`) + tokens del
// design system. No usamos `<Tabs.Indicator />`: en HeroUI 3.2.3 el indicador
// depende de una API experimental de react-aria (`SelectionIndicator`/
// `SharedElement`) que la versión instalada (rac 1.20) no cablea → rompe.
const TAB_CLASS =
  'cursor-pointer rounded-xl px-4 py-2 text-center text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors data-[hovered]:text-foreground data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm';

/**
 * Contenedor del dominio Mantenimiento: cada sección es una sub-vista
 * independiente con sus propios hooks. `Tabs` controladas (`selectedKey`)
 * para poder manejar la selección desde dos navegaciones distintas según
 * viewport:
 *  - Desktop (`md+`): segmented control arriba.
 *  - Móvil (`< md`): bottom tab bar fija (mismo patrón que el shell de
 *    Terreno), porque en ese ancho el sidebar de la app ya es drawer.
 */
export function MantenimientoView() {
  const { role } = useCurrentUser();
  const [selected, setSelected] = useState<Key>('ordenes');

  const sections = SECTIONS.filter((s) => !s.adminOnly || role === ROLES.ADMIN);
  const gridColumns = { gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` };

  return (
    // pb en móvil deja aire para que el contenido no quede bajo la barra fija.
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Mantenimiento
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Taller
        </h1>
        <p className="text-sm text-muted-foreground">
          {role === ROLES.ADMIN
            ? 'Hallazgos, operaciones, stock del taller, plan preventivo y tareas.'
            : 'Hallazgos, operaciones y consumo de stock del taller.'}
        </p>
      </div>

      <Tabs selectedKey={selected} onSelectionChange={setSelected}>
        {/* Control superior (segmented) — solo desktop */}
        <Tabs.List
          aria-label="Secciones de Mantenimiento"
          className="hidden gap-1 rounded-2xl bg-black/[0.04] p-1 md:inline-grid"
          style={gridColumns}
        >
          {sections.map((s) => (
            <Tabs.Tab key={s.id} id={s.id} className={TAB_CLASS}>
              {s.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {sections.map((s) => (
          <Tabs.Panel key={s.id} id={s.id} className="pt-2 md:pt-6">
            {PANELS[s.id]()}
          </Tabs.Panel>
        ))}
      </Tabs>

      {/* Bottom tab bar — solo móvil (mismo estilo que el shell de Terreno) */}
      <nav
        aria-label="Secciones de Mantenimiento"
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-border bg-card/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
        style={gridColumns}
      >
        {sections.map((s) => {
          const Icon = s.icon;
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              {s.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
