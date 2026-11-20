import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@heroui/react';
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, Send, XCircle } from 'lucide-react';

import { useDailyChecklists } from '../../hooks/useDailyChecklists';
import { usePermissions } from '../../hooks/usePermissions';
import { canOpenPath } from '../../lib/permissions';
import { toDateOnly } from '../../lib/turno';
import type { ChecklistStatus } from '../../types/daily-checklist';

const RUTA = '/chequeos-diarios';

interface Recuadro {
  label: string;
  hint: string;
  valor: number;
  /** Estado con el que abre la vista; sin él abre todos. */
  estado?: ChecklistStatus;
  Icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Fondo, borde y color del ícono/número: tokens del design system. */
  tono: string;
}

function RecuadroCifra({ r, onOpen }: { r: Recuadro; onOpen?: () => void }) {
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider uppercase">{r.label}</span>
        <r.Icono aria-hidden className="h-4 w-4 shrink-0" />
      </div>
      <span className="font-display text-[30px] leading-none font-semibold tracking-[-0.02em]">
        {r.valor.toLocaleString('es-CL')}
      </span>
      <span className="text-xs opacity-80">{r.hint}</span>
    </>
  );
  const clases = `flex flex-col gap-2 rounded-xl border p-3.5 text-left ${r.tono}`;
  const testId = `chequeos-hoy-${r.label.toLowerCase().replace(/\s/g, '-')}`;

  if (!onOpen) {
    return (
      <div className={clases} data-testid={testId}>
        {contenido}
      </div>
    );
  }
  return (
    <button
      aria-label={`${r.label}: ${r.valor}. Ver en Chequeos diarios`}
      className={`${clases} transition-[filter,transform] hover:brightness-[0.97] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)`}
      data-testid={testId}
      onClick={onOpen}
      type="button"
    >
      {contenido}
    </button>
  );
}

/** Barra apilada: cuánto del día ya está decidido por el supervisor. */
function BarraValidacion({ aceptados, rechazados, porValidar }: { aceptados: number; rechazados: number; porValidar: number }) {
  const total = aceptados + rechazados + porValidar;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const validados = aceptados + rechazados;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">{validados}</strong> de {total} validados por el supervisor
        </span>
        <span>{Math.round((validados / total) * 100)} %</span>
      </div>
      <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-(--surface-tertiary)">
        <span className="h-full bg-success" style={{ width: pct(aceptados) }} />
        <span className="h-full bg-danger" style={{ width: pct(rechazados) }} />
        <span className="h-full bg-warning" style={{ width: pct(porValidar) }} />
      </div>
    </div>
  );
}

/**
 * Dashboard: cómo van hoy los chequeos diarios del mantenedor — enviados, los
 * que esperan al supervisor, los aceptados y los rechazados — con una barra de
 * avance de la validación. Cada recuadro abre la vista completa ya filtrada
 * por ese estado (`?estado=`). Query propia: si falla, el resto del dashboard
 * sigue.
 */
export function ChequeosHoyCard() {
  const { data, isPending, isError, error } = useDailyChecklists(toDateOnly(new Date()));
  const navigate = useNavigate();
  const puedeAbrir = canOpenPath(usePermissions().role, RUTA);

  const chequeos = data ?? [];
  const cuenta = (estado: ChecklistStatus) => chequeos.filter((c) => c.status === estado).length;
  const porValidar = cuenta('SUBMITTED');
  const aceptados = cuenta('ACCEPTED');
  const rechazados = cuenta('REJECTED');

  const recuadros: Recuadro[] = [
    {
      label: 'Enviados',
      hint: 'Por los mantenedores',
      valor: chequeos.length,
      Icono: Send,
      tono: 'border-border bg-(--surface-secondary) text-foreground',
    },
    {
      label: 'Por validar',
      hint: 'Esperan al supervisor',
      valor: porValidar,
      estado: 'SUBMITTED',
      Icono: Clock,
      tono: 'border-transparent bg-warning-soft text-warning-soft-foreground',
    },
    {
      label: 'Aceptados',
      hint: 'Equipo liberado',
      valor: aceptados,
      estado: 'ACCEPTED',
      Icono: CheckCircle2,
      tono: 'border-transparent bg-success-soft text-success-soft-foreground',
    },
    {
      label: 'Rechazados',
      hint: 'Vuelven al mantenedor',
      valor: rechazados,
      estado: 'REJECTED',
      Icono: XCircle,
      tono: 'border-transparent bg-danger-soft text-danger-soft-foreground',
    },
  ];

  const abrir = (estado?: ChecklistStatus) => void navigate(estado ? `${RUTA}?estado=${estado}` : RUTA);

  return (
    <Card aria-label="Chequeos de hoy">
      <Card.Header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
              <ClipboardCheck aria-hidden className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-0.5">
              <Card.Title>Chequeos de hoy</Card.Title>
              <Card.Description>Lo que enviaron los mantenedores y cómo va su validación.</Card.Description>
            </div>
          </div>
          {puedeAbrir ? (
            <Button aria-label="Ver chequeos" onPress={() => abrir()} size="sm" variant="secondary">
              Ver chequeos
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
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
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {recuadros.map((r) => (
                <RecuadroCifra key={r.label} onOpen={puedeAbrir ? () => abrir(r.estado) : undefined} r={r} />
              ))}
            </div>
            {chequeos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no se envía ningún chequeo hoy.</p>
            ) : (
              <BarraValidacion aceptados={aceptados} porValidar={porValidar} rechazados={rechazados} />
            )}
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}
