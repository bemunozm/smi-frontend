import { Chip, ProgressBar } from './ui'
import { estadoPreventivoLabel, estadoPreventivoTone } from '../status-styles'
import { formatNumber } from '../format'
import type { EquipoRef, EstadoPreventivo } from '../types'

interface EquipoUmbralCardProps {
  equipo: EquipoRef
  horasActuales: number
  horasUmbral: number
  pct: number
  estado: EstadoPreventivo
  horasFaltantes: number
  plan: string
  otGenerada?: string
}

export function EquipoUmbralCard({
  equipo,
  horasActuales,
  horasUmbral,
  pct,
  estado,
  horasFaltantes,
  plan,
  otGenerada,
}: EquipoUmbralCardProps) {
  const vencido = horasFaltantes < 0

  return (
    <div className="rounded-(--radius) border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-foreground">{equipo.codigo}</p>
          <p className="text-xs text-muted-foreground">{equipo.tipo}</p>
        </div>
        <Chip tone={estadoPreventivoTone(estado)}>{estadoPreventivoLabel(estado)}</Chip>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {formatNumber(horasActuales)} h / {formatNumber(horasUmbral)} h
      </p>
      <ProgressBar value={pct} tone={estadoPreventivoTone(estado)} className="mt-1.5" />
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">
        {vencido ? `Vencido ${formatNumber(Math.abs(horasFaltantes))} h` : `Faltan ${formatNumber(horasFaltantes)} h`}
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-foreground">{plan}</span>
        <span className="font-mono text-muted-foreground">{otGenerada ?? 'Sin OT'}</span>
      </div>
    </div>
  )
}
