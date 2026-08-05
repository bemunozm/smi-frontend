import { TONE_TEXT_CLASSES, type Tone } from '../../status-styles'

interface StatTileProps {
  label: string
  value: number | string
  tone?: Tone
}

export function StatTile({ label, value, tone = 'neutral' }: StatTileProps) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-(--radius) border border-border bg-card px-3 py-3">
      <span className={`text-2xl font-semibold ${TONE_TEXT_CLASSES[tone]}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
