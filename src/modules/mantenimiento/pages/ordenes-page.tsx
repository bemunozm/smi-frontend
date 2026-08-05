import { IconPlus, SegmentedControl, StatTile } from '../components/ui'
import { OrdenCard } from '../components'
import { useOrdenes } from '../hooks'
import type { FiltroOT } from '../types'

const FILTROS: { value: FiltroOT; label: string }[] = [
  { value: 'TODAS', label: 'TODAS' },
  { value: 'ABIERTA', label: 'ABIERTA' },
  { value: 'PROCESO', label: 'PROCESO' },
  { value: 'CERRADA', label: 'CERRADA' },
]

interface OrdenesPageProps {
  onAbrirBitacora: () => void
}

export function OrdenesPage({ onAbrirBitacora }: OrdenesPageProps) {
  const { ordenesFiltradas, stats, filtro, setFiltro, toggleTarea, crearOrden } = useOrdenes()

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mis órdenes</h1>
        <p className="text-sm text-muted-foreground">Asignadas a L. Fuentes · turno mañana</p>
      </div>

      <button
        type="button"
        onClick={crearOrden}
        className="flex items-center justify-center gap-2 rounded-(--radius) bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <IconPlus className="h-4 w-4" />
        Crear orden de trabajo
      </button>

      <div className="flex gap-2">
        <StatTile label="Abiertas" value={stats.abiertas} tone="neutral" />
        <StatTile label="En proceso" value={stats.enProceso} tone="info" />
        <StatTile label="Cerradas" value={stats.cerradas} tone="success" />
      </div>

      <SegmentedControl options={FILTROS} value={filtro} onChange={setFiltro} />

      <div className="flex flex-col gap-3">
        {ordenesFiltradas.map((orden) => (
          <OrdenCard
            key={orden.id}
            orden={orden}
            onToggleTarea={(tareaId) => toggleTarea(orden.id, tareaId)}
            onAbrirBitacora={onAbrirBitacora}
          />
        ))}
      </div>
    </div>
  )
}
