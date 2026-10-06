import { useState } from 'react';
import { ClipboardList, Gauge, ListChecks, Package } from 'lucide-react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { ROLES } from '../types/roles';
import { ActividadesView } from './ActividadesView';
import { OrdenesTrabajoView } from './OrdenesTrabajoView';
import { PreventivoView } from './PreventivoView';
import { WorkshopStockView } from './WorkshopStockView';

/**
 * Secciones del dominio — única fuente de la barra inferior.
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

type SectionId = (typeof SECTIONS)[number]['id'];

const PANELS: Record<SectionId, () => React.ReactNode> = {
  ordenes: () => <OrdenesTrabajoView />,
  stock: () => <WorkshopStockView />,
  preventivo: () => <PreventivoView />,
  tareas: () => <ActividadesView />,
};

/**
 * Contenedor del dominio Mantenimiento. La navegación entre secciones es la
 * barra inferior fija del kit de Terreno —el taller se usa en tablet, con
 * guantes— en TODOS los anchos: mismo lenguaje que `TerrenoLayout`.
 */
export function MantenimientoView() {
  const { role } = useCurrentUser();
  const [selected, setSelected] = useState<SectionId>('ordenes');

  const sections = SECTIONS.filter((s) => !s.adminOnly || role === ROLES.ADMIN);

  return (
    // pb deja aire para que el contenido no quede bajo la barra fija.
    <div className="flex flex-col gap-4 pb-24">
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

      <div>{PANELS[selected]()}</div>

      {/* Barra inferior del kit de Terreno — misma receta que TerrenoLayout. */}
      <nav
        aria-label="Secciones de Mantenimiento"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/[.97] pb-[env(safe-area-inset-bottom)] backdrop-blur"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="mx-auto grid max-w-3xl px-1.5"
          style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}
        >
          {sections.map((s) => {
            const Icon = s.icon;
            const active = selected === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 cursor-pointer flex-col items-center gap-1 px-0.5 pt-2.5 pb-3 text-xs font-semibold transition ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
                onClick={() => setSelected(s.id)}
              >
                <Icon className="h-[23px] w-[23px]" strokeWidth={active ? 2.4 : 2} />
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
