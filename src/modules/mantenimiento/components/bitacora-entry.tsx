import { Chip } from './ui'
import { tipoOTLabel } from '../status-styles'
import type { BitacoraEntrada } from '../types'

interface BitacoraEntryProps {
  entrada: BitacoraEntrada
}

export function BitacoraEntry({ entrada }: BitacoraEntryProps) {
  return (
    <div className="rounded-(--radius) border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{entrada.autor}</span>
          <span>·</span>
          <span>{entrada.fecha}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Chip>{tipoOTLabel(entrada.tipo)}</Chip>
          {entrada.soloLectura ? <Chip tone="info">SOLO LECTURA</Chip> : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground">{entrada.resumen}</p>
    </div>
  )
}
