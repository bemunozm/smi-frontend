import { Avatar, Chip, IconCheck } from './ui'
import { estadoActividadLabel, estadoActividadTone } from '../status-styles'
import type { Actividad } from '../types'

interface ActividadItemProps {
  actividad: Actividad
  onToggle: () => void
}

export function ActividadItem({ actividad, onToggle }: ActividadItemProps) {
  const completada = actividad.estado === 'COMPLETADA'

  return (
    <div className="flex items-start gap-3 rounded-(--radius) border border-border bg-card p-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Cambiar estado de la actividad"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          completada ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'
        }`}
      >
        {completada ? <IconCheck className="h-3.5 w-3.5" /> : null}
      </button>

      <div className="flex-1">
        <p className={`text-sm font-medium ${completada ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {actividad.descripcion}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip tone={estadoActividadTone(actividad.estado)}>{estadoActividadLabel(actividad.estado)}</Chip>
          <Chip mono>{actividad.referencia}</Chip>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Avatar iniciales={actividad.asignadoA.iniciales} size="sm" />
            {actividad.asignadoA.nombre}
          </span>
        </div>
      </div>
    </div>
  )
}
