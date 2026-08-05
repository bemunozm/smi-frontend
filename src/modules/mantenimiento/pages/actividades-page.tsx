import { Avatar, Chip, SectionLabel, SegmentedControl } from '../components/ui'
import { ActividadItem } from '../components'
import { useActividades } from '../hooks'
import { MECANICOS } from '../data/mock'
import { origenActividadCampo } from '../status-styles'
import type { OrigenActividad } from '../types'

const ORIGENES: { value: OrigenActividad; label: string }[] = [
  { value: 'HALLAZGO', label: 'HALLAZGO' },
  { value: 'EQUIPO', label: 'EQUIPO' },
  { value: 'MANUAL', label: 'LIBRE' },
]

const MECANICOS_LISTA = Object.values(MECANICOS)

export function ActividadesPage() {
  const {
    actividades,
    completadas,
    total,
    toggleActividad,
    origen,
    setOrigen,
    referencia,
    setReferencia,
    asignadoA,
    setAsignadoA,
    descripcion,
    setDescripcion,
    asignarActividad,
  } = useActividades()

  const campo = origenActividadCampo(origen)

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Asignar actividad</h1>
        <p className="text-sm text-muted-foreground">Crea y asigna tareas al equipo de mantención</p>
      </div>

      <div className="flex flex-col gap-2">
        <SegmentedControl options={ORIGENES} value={origen} onChange={setOrigen} />
        <p className="text-xs text-muted-foreground">{campo.hint}</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{campo.label}</span>
        <input
          type="text"
          value={referencia}
          onChange={(event) => setReferencia(event.target.value)}
          placeholder={campo.placeholder}
          className="rounded-(--radius) border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Asignar a</span>
        <div className="flex flex-wrap gap-2">
          {MECANICOS_LISTA.map((mecanico) => {
            const activo = mecanico.nombre === asignadoA.nombre
            return (
              <button
                key={mecanico.nombre}
                type="button"
                onClick={() => setAsignadoA(mecanico)}
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  activo ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <Avatar iniciales={mecanico.iniciales} size="sm" />
                {mecanico.nombre}
              </button>
            )
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Descripción</span>
        <textarea
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          rows={3}
          placeholder="Describe la actividad a realizar..."
          className="resize-none rounded-(--radius) border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </label>

      <button
        type="button"
        onClick={asignarActividad}
        disabled={!descripcion.trim()}
        className="rounded-(--radius) bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Asignar actividad
      </button>

      <div className="flex flex-col gap-2">
        <SectionLabel action={<Chip tone="success">Completadas {completadas} / {total}</Chip>}>
          Seguimiento del día
        </SectionLabel>
        <div className="flex flex-col gap-2">
          {actividades.map((actividad) => (
            <ActividadItem key={actividad.id} actividad={actividad} onToggle={() => toggleActividad(actividad.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}
