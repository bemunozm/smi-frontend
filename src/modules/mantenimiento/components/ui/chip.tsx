import type { ReactNode } from 'react'
import { TONE_CLASSES, type Tone } from '../../status-styles'

interface ChipProps {
  children: ReactNode
  tone?: Tone
  /** Texto en fuente mono, usado para códigos de OT/equipo/insumo. */
  mono?: boolean
  className?: string
}

export function Chip({ children, tone = 'neutral', mono = false, className = '' }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]} ${mono ? 'font-mono' : ''} ${className}`}
    >
      {children}
    </span>
  )
}
