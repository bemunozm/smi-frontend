import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@heroui/react';

import { useDailyChecklists } from '../../hooks/useDailyChecklists';
import { usePermissions } from '../../hooks/usePermissions';
import { canOpenPath } from '../../lib/permissions';
import { toDateOnly } from '../../lib/turno';

const RUTA = '/chequeos-diarios';

function Cifra({ label, valor, alerta }: { label: string; valor: number; alerta?: boolean }) {
  return (
    <div className="flex flex-col" data-testid={`chequeos-hoy-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">{label}</span>
      <span
        className={`font-display text-[26px] font-semibold tracking-[-0.02em] ${
          alerta && valor > 0 ? 'text-danger-soft-foreground' : 'text-foreground'
        }`}
      >
        {valor.toLocaleString('es-CL')}
      </span>
    </div>
  );
}

/**
 * Dashboard: cómo van los chequeos diarios del mantenedor hoy (enviados, los
 * que esperan al supervisor y los rechazados), con el atajo a la vista completa.
 * Query propia: si falla, el resto del dashboard sigue.
 */
export function ChequeosHoyCard() {
  const { data, isPending, isError, error } = useDailyChecklists(toDateOnly(new Date()));
  const navigate = useNavigate();
  const puedeAbrir = canOpenPath(usePermissions().role, RUTA);

  const chequeos = data ?? [];
  const porValidar = chequeos.filter((c) => c.status === 'SUBMITTED').length;
  const rechazados = chequeos.filter((c) => c.status === 'REJECTED').length;

  return (
    <Card aria-label="Chequeos de hoy">
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Card.Title>Chequeos de hoy</Card.Title>
          {puedeAbrir ? (
            <Button onPress={() => void navigate(RUTA)} size="sm" variant="secondary">
              Ver chequeos →
            </Button>
          ) : null}
        </div>
        <Card.Description>Lo que enviaron los mantenedores y cómo va su validación.</Card.Description>
      </Card.Header>
      <Card.Content>
        {isPending ? (
          <div className="flex justify-center py-4">
            <Spinner color="accent" size="sm" />
          </div>
        ) : null}

        {isError ? (
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudieron cargar los chequeos de hoy.'}
          </p>
        ) : null}

        {!isPending && !isError ? (
          chequeos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se envía ningún chequeo hoy.</p>
          ) : (
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <Cifra label="Enviados" valor={chequeos.length} />
              <Cifra label="Por validar" valor={porValidar} />
              <Cifra alerta label="Rechazados" valor={rechazados} />
            </div>
          )
        ) : null}
      </Card.Content>
    </Card>
  );
}
