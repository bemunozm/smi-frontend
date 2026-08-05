interface AvatarProps {
  iniciales: string
  size?: 'sm' | 'md'
  className?: string
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
}

export function Avatar({ iniciales, size = 'md', className = '' }: AvatarProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${SIZE_CLASSES[size]} ${className}`}
    >
      {iniciales}
    </span>
  )
}
