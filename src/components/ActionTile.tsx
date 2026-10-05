import { Button } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';

/**
 * Tile de la hoja de acciones (tablet/celular) que abre al tocar una tarjeta
 * de listado: ícono en una insignia redondeada + etiqueta debajo. `tone="danger"`
 * solo tiñe la insignia (el tile queda neutro, no se pinta rojo entero).
 *
 * `variant="outline"` (no `secondary`/`tertiary`) + `bg-surface` explícito:
 * `secondary` pinta el botón gris sobre el fondo blanco del sheet y se lee
 * "apagado", y `tertiary` hereda `currentColor` (ver el fix de `.drawer__body`
 * en `index.css`). `outline` fija su propio `--button-fg`; la etiqueta igual va
 * en su propio `<span className="text-foreground">` para no depender de la
 * variante.
 *
 * Ancho fijo a `calc(50% - gap/2)` (no `fullWidth`/grid): el padre es un
 * `flex flex-wrap justify-center`, así que entran 2 tiles por fila y, como
 * `justify-content` se aplica POR LÍNEA, un tile impar al final queda centrado
 * solo en su fila sin lógica condicional en el llamador.
 */
export function ActionTile({
  icon: Icon,
  label,
  onPress,
  isDisabled,
  tone = 'accent',
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
  tone?: 'accent' | 'danger';
}) {
  return (
    <Button
      className="h-auto w-[calc(50%-0.375rem)] flex-col gap-2.5 rounded-2xl border border-border bg-surface py-4 text-center text-[13px] font-semibold whitespace-normal"
      isDisabled={isDisabled}
      onPress={onPress}
      variant="outline"
    >
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
          tone === 'danger' ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-accent-soft text-accent-soft-foreground'
        }`}
      >
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <span className="text-foreground">{label}</span>
    </Button>
  );
}
