import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  action?: ReactNode
}

export function SectionLabel({ children, action }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  )
}
