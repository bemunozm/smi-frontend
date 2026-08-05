import type { ReactNode } from 'react'

interface PhoneFrameProps {
  children: ReactNode
}

/**
 * Envoltorio del shell: en mobile ocupa el 100% del viewport (sin scroll horizontal).
 * En desktop simula un dispositivo móvil centrado, coherente con el mockup del cliente.
 */
export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-background sm:items-center sm:bg-muted sm:py-8">
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background sm:h-[844px] sm:w-[390px] sm:rounded-[2.5rem] sm:border sm:border-border sm:shadow-2xl">
        {children}
      </div>
    </div>
  )
}
