import { ImageIcon } from 'lucide-react';

import { assetUrl } from '../../api/UploadsAPI';

interface EquipoThumbProps {
  photoUrl: string | null | undefined;
  alt: string;
  /** `sm` = fila de tabla (PC), `md` = tarjeta (tablet/celular), `lg` =
   * modal de crear/editar — calca los tamaños de `.thumb` en
   * `FlotaClientePC/Tablet/Phone.dc.html`. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-[46px] w-[46px] rounded-[10px]',
  md: 'h-[52px] w-[52px] rounded-[11px]',
  lg: 'h-[72px] w-[72px] rounded-xl',
};

const ICON_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-5 w-5',
  md: 'h-5.5 w-5.5',
  lg: 'h-7 w-7',
};

/** Miniatura de foto del equipo, con fallback a un ícono cuando `photoUrl`
 * es `null` — mismo componente para la tabla PC y las tarjetas tablet/celular
 * (y candidato a reusar en la ficha, Fase 2). */
export function EquipoThumb({ photoUrl, alt, size = 'sm', className }: EquipoThumbProps) {
  const src = assetUrl(photoUrl);
  const sizeClasses = SIZE_CLASSES[size];

  if (src) {
    return (
      <img
        alt={alt}
        className={`shrink-0 border border-border object-cover ${sizeClasses} ${className ?? ''}`}
        src={src}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border border-border bg-surface-tertiary text-(--muted) ${sizeClasses} ${className ?? ''}`}
    >
      <ImageIcon className={ICON_SIZE_CLASSES[size]} />
    </span>
  );
}
