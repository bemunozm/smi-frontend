import { Avatar, Chip, IconCheck, IconChevronRight } from './ui'
import {
  estadoOTLabel,
  estadoOTTone,
  origenOTLabel,
  prioridadAccentBorderClass,
  prioridadLabel,
  prioridadTone,
} from '../status-styles'
import type { OrdenTrabajo } from '../types'

interface OrdenCardProps {
  orden: OrdenTrabajo
  onToggleTarea: (tareaId: string) => void
  onAbrirBitacora: () => void
}

export function OrdenCard({ orden, onToggleTarea, onAbrirBitacora }: OrdenCardProps) {
  const hechas = orden.tareas.filter((tarea) => tarea.hecha).length

  return (
    <article
      className={`rounded-(--radius) border border-border border-l-4 bg-card p-4 ${prioridadAccentBorderClass(orden.prioridad)}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">{orden.id}</span>
        <Chip tone={prioridadTone(orden.prioridad)}>{prioridadLabel(orden.prioridad)}</Chip>
        <span className="text-xs text-muted-foreground">{orden.hora}</span>
        <div className="ml-auto flex items-center gap-2">
          <Chip mono>{orden.equipo.codigo}</Chip>
          <Chip tone={estadoOTTone(orden.estado)}>{estadoOTLabel(orden.estado)}</Chip>
        </div>
      </header>

      <h3 className="mt-2 text-sm font-semibold text-foreground">{orden.titulo}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{origenOTLabel(orden.origen, orden.origenDetalle)}</p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {orden.tareas.map((tarea) => (
          <li key={tarea.id}>
            <button
              type="button"
              onClick={() => onToggleTarea(tarea.id)}
              className="flex w-full items-center gap-2 text-left text-sm"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  tarea.hecha ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                }`}
              >
                {tarea.hecha ? <IconCheck className="h-3 w-3" /> : null}
              </span>
              <span className={tarea.hecha ? 'text-muted-foreground line-through' : 'text-foreground'}>
                {tarea.texto}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">
        {hechas}/{orden.tareas.length} actividades
      </p>

      <footer className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Avatar iniciales={orden.mecanico.iniciales} size="sm" />
          <span className="text-xs font-medium text-foreground">{orden.mecanico.nombre}</span>
        </div>
        <button
          type="button"
          onClick={onAbrirBitacora}
          className="flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Abrir bitácora
          <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </article>
  )
}
