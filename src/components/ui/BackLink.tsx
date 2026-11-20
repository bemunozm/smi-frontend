import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface BackLinkProps {
  /** Ruta a la que regresa. */
  to: string;
  /** Texto visible, sin flecha (la pone el componente): «Volver a Inventario». */
  children: ReactNode;
}

/**
 * Enlace «Volver» de las sub-vistas (fichas, historiales, calendarios): flecha
 * + texto en el color de acento, con un fondo suave al pasar el mouse para que
 * se lea como un control y no como texto suelto (pedido del cliente,
 * 20/11/2026). Una sola pieza para que todos los módulos vuelvan igual.
 */
export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link
      className="group -ml-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[15px] font-semibold text-(--accent) transition-colors hover:bg-(--accent-soft) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:outline-none"
      to={to}
    >
      <ArrowLeft
        aria-hidden
        className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
      />
      {children}
    </Link>
  );
}
