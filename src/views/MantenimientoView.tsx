import { useState } from 'react';
import { Tabs } from '@heroui/react';
import type { Key } from '@heroui/react';
import { ClipboardList, Gauge, ListChecks, NotebookPen } from 'lucide-react';

import { ActividadesView } from './ActividadesView';
import { BitacoraView } from './BitacoraView';
import { OrdenesTrabajoView } from './OrdenesTrabajoView';
import { PreventivoView } from './PreventivoView';

// Secciones del dominio. Única fuente para el control superior (desktop) y
// la barra inferior (móvil), así label/orden no se desincronizan.
const SECTIONS = [
  { id: 'ordenes', label: 'Órdenes', icon: ClipboardList },
  { id: 'bitacora', label: 'Bitácora', icon: NotebookPen },
  { id: 'preventivo', label: 'Preventivo', icon: Gauge },
  { id: 'tareas', label: 'Tareas', icon: ListChecks },
] as const;

// Estilo de cada pestaña del segmented control (desktop). Estados vía
// data-attrs de react-aria (`data-selected`/`data-hovered`) + tokens del
// design system. No usamos `<Tabs.Indicator />`: en HeroUI 3.2.3 el indicador
// depende de una API experimental de react-aria (`SelectionIndicator`/
// `SharedElement`) que la versión instalada (rac 1.20) no cablea → rompe.
const TAB_CLASS =
  'cursor-pointer rounded-xl px-4 py-2 text-center text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors data-[hovered]:text-foreground data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm';

/**
 * Contenedor del dominio Mantenimiento: 4 secciones, cada una una sub-vista
 * independiente con sus propios hooks (`useOrdenes`, `useIntervenciones`,
 * `useUmbrales`, `useActividades`). `Tabs` controladas (`selectedKey`) para
 * poder manejar la selección desde dos navegaciones distintas según viewport:
 *  - Desktop (`md+`): segmented control arriba.
 *  - Móvil (`< md`): bottom tab bar fija (mismo patrón que el shell de
 *    Terreno), porque en ese ancho el sidebar de la app ya es drawer.
 */
export function MantenimientoView() {
  const [selected, setSelected] = useState<Key>('ordenes');

  return (
    // pb en móvil deja aire para que el contenido no quede bajo la barra fija.
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Mantenimiento
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Mantenimiento
        </h1>
        <p className="text-sm text-muted-foreground">
          Órdenes de trabajo, bitácora de intervenciones, plan preventivo y actividades del equipo.
        </p>
      </div>

      <Tabs selectedKey={selected} onSelectionChange={setSelected}>
        {/* Control superior (segmented) — solo desktop */}
        <Tabs.List
          aria-label="Secciones de Mantenimiento"
          className="hidden gap-1 rounded-2xl bg-black/[0.04] p-1 md:inline-grid md:grid-cols-4"
        >
          {SECTIONS.map((s) => (
            <Tabs.Tab key={s.id} id={s.id} className={TAB_CLASS}>
              {s.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel id="ordenes" className="pt-2 md:pt-6">
          <OrdenesTrabajoView />
        </Tabs.Panel>
        <Tabs.Panel id="bitacora" className="pt-2 md:pt-6">
          <BitacoraView />
        </Tabs.Panel>
        <Tabs.Panel id="preventivo" className="pt-2 md:pt-6">
          <PreventivoView />
        </Tabs.Panel>
        <Tabs.Panel id="tareas" className="pt-2 md:pt-6">
          <ActividadesView />
        </Tabs.Panel>
      </Tabs>

      {/* Bottom tab bar — solo móvil (mismo estilo que el shell de Terreno) */}
      <nav
        aria-label="Secciones de Mantenimiento"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {SECTIONS.map((s) => {
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
