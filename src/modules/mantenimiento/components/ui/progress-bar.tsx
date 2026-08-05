import { TONE_BAR_CLASSES, type Tone } from '../../status-styles'

interface ProgressBarProps {
  /** Porcentaje 0-100. Se recorta (clamp) al rango válido. */
  value: number
  tone?: Tone
  className?: string
}

export function ProgressBar({ value, tone = 'info', className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${TONE_BAR_CLASSES[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
