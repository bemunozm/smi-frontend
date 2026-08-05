import { Card } from '@heroui/react';

export interface PlaceholderViewProps {
  title: string;
}

/** Página placeholder para módulos de dominio que todavía no existen. */
export function PlaceholderView({ title }: PlaceholderViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <Card variant="transparent">
        <Card.Content>
          <p className="text-sm text-muted">
            Este módulo está en construcción. Se implementará cuando el dominio de{' '}
            {title.toLowerCase()} esté disponible.
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}
