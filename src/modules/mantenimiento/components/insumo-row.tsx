import { IconAlertTriangle, Stepper } from './ui'
import { formatNumber } from '../format'
import type { InsumoRef } from '../types'

interface InsumoRowProps {
  insumo: InsumoRef
  cantidad: number
  antes: number
  despues: number
  bajoMinimo: boolean
  onIncrement: () => void
  onDecrement: () => void
}

export function InsumoRow({
  insumo,
  cantidad,
  antes,
  despues,
  bajoMinimo,
  onIncrement,
  onDecrement,
}: InsumoRowProps) {
  return (
    <div className="rounded-(--radius) border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{insumo.nombre}</p>
          <p className="font-mono text-xs text-muted-foreground">{insumo.codigo}</p>
        </div>
        <Stepper value={cantidad} onIncrement={onIncrement} onDecrement={onDecrement} unidad={insumo.unidad} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Stock: {formatNumber(antes)} →{' '}
        <span className={bajoMinimo ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-foreground'}>
          {formatNumber(despues)}
        </span>{' '}
        {insumo.unidad}
      </p>

      {bajoMinimo ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-(--radius) bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Queda bajo el stock mínimo ({formatNumber(insumo.stockMinimo)} {insumo.unidad})
        </p>
      ) : null}
    </div>
  )
}
