import { useState, type ComponentType } from 'react'
import {
  IconActivity,
  IconBookOpen,
  IconCheckSquare,
  IconClipboardList,
  PhoneFrame,
} from './components/ui'
import { ActividadesPage, BitacoraPage, OrdenesPage, PreventivoPage } from './pages'

type Pagina = 'ordenes' | 'bitacora' | 'preventivo' | 'actividades'

interface NavItem {
  value: Pagina
  label: string
  Icon: ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { value: 'ordenes', label: 'Órdenes', Icon: IconClipboardList },
  { value: 'bitacora', label: 'Bitácora', Icon: IconBookOpen },
  { value: 'preventivo', label: 'Preventivo', Icon: IconActivity },
  { value: 'actividades', label: 'Tareas', Icon: IconCheckSquare },
]

// En Sprint 0 cada página monta bajo routes.tsx y esta bottom-nav pasa a ser el menú del layout de shared/
export function MantenimientoApp() {
  const [pagina, setPagina] = useState<Pagina>('ordenes')

  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto p-4">
        {pagina === 'ordenes' ? <OrdenesPage onAbrirBitacora={() => setPagina('bitacora')} /> : null}
        {pagina === 'bitacora' ? <BitacoraPage /> : null}
        {pagina === 'preventivo' ? <PreventivoPage /> : null}
        {pagina === 'actividades' ? <ActividadesPage /> : null}
      </div>

      <nav className="flex shrink-0 items-stretch border-t border-border bg-card">
        {NAV_ITEMS.map(({ value, label, Icon }) => {
          const activo = value === pagina
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPagina(value)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                activo ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          )
        })}
      </nav>
    </PhoneFrame>
  )
}
