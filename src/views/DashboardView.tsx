import { Card } from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';

interface MockStat {
  label: string;
  value: string;
  hint: string;
}

const MOCK_STATS: readonly MockStat[] = [
  { label: 'Equipos activos', value: '128', hint: '+4 esta semana' },
  { label: 'Inventario bajo mínimo', value: '7', hint: 'Requiere revisión' },
  { label: 'Actividades pendientes', value: '23', hint: '5 vencen hoy' },
  { label: 'Notificaciones sin leer', value: '3', hint: 'Últimas 24h' },
];

export function DashboardView() {
  const { user } = useCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Dashboard
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Hola, {user?.name || user?.email}
        </h1>
        <p className="text-sm text-muted">
          Resumen general del sistema. Los datos de esta vista son de ejemplo — se conectarán
          cuando existan los módulos de dominio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_STATS.map((stat) => (
          <Card key={stat.label}>
            <Card.Header>
              <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                {stat.label}
              </Card.Description>
              <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
                {stat.value}
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <p className="text-xs text-muted">{stat.hint}</p>
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
}
