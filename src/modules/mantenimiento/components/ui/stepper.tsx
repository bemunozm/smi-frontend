import { IconMinus, IconPlus } from './icons'

interface StepperProps {
  value: number
  onIncrement: () => void
  onDecrement: () => void
  unidad?: string
}

export function Stepper({ value, onIncrement, onDecrement, unidad }: StepperProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Disminuir"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <IconMinus className="h-3.5 w-3.5" />
      </button>
      <span className="w-14 text-center text-sm font-semibold text-foreground">
        {value}
        {unidad ? <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unidad}</span> : null}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Aumentar"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <IconPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
