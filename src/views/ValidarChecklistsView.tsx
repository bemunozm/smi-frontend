import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleX } from 'lucide-react';

import { ContenidoChecklist, ResultadoRevision } from '../components/checklist/ChecklistDetalle';
import { CHECKLIST_ESTADO } from '../components/checklist/checklist-estado';
import {
  Boton,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  ModalTerreno,
  Textarea,
  VistaHead,
  VistaUnica,
} from '../components/terreno/ui';
import {
  useChecklistDetalle,
  useChecklistsPorEstado,
  useDailyChecklists,
  useReviewChecklist,
} from '../hooks/useDailyChecklists';
import { usePermissions } from '../hooks/usePermissions';
import { fmtTime } from '../lib/format';
import { fechaCorta, fromDateOnly, toDateOnly } from '../lib/turno';
import type { DailyChecklistDetail, DailyChecklistSummary } from '../types/daily-checklist';

const POR_VALIDAR = ['SUBMITTED'] as const;

/**
 * Módulo 3 · R25 — validación del supervisor. El mantenedor hace el chequeo
 * (por lo general en la colación) y el supervisor, al volver, prueba el
 * equipo y mira lo declarado: si está todo bien lo acepta y el equipo queda
 * liberado para abrir turno; si no, lo rechaza con lo que hay que corregir y
 * vuelve al mantenedor.
 *
 * `?id=` abre un chequeo directo (el aviso de la notificación lleva acá).
 */
export function ValidarChecklistsView() {
  const hoy = toDateOnly(new Date());
  const [params, setParams] = useSearchParams();
  const abierto = params.get('id');
  const { data: pendientes, isLoading } = useChecklistsPorEstado(POR_VALIDAR);
  const { data: delDia } = useDailyChecklists(hoy);
  const validadosHoy = (delDia ?? []).filter((c) => c.status !== 'SUBMITTED');

  const abrir = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('id', id);
        else next.delete('id');
        return next;
      },
      { replace: true },
    );

  return (
    <VistaUnica>
      <VistaHead titulo="Chequeos por validar" contexto={<ChipContexto>{fechaCorta(new Date())}</ChipContexto>} />

      <Card>
        <CardHead
          titulo="Por validar"
          bajada="Prueba el equipo y revisa lo que declaró el mantenedor. El equipo no se libera hasta que lo aceptes."
          extra={pendientes?.length ? <Chip tono="warning">{pendientes.length}</Chip> : undefined}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !pendientes?.length ? (
          <p className="text-sm text-muted-foreground">
            Nada por validar. Cuando el mantenedor envíe un chequeo, aparece acá.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendientes.map((c) => (
              <li key={c.id}>
                <FilaChecklist checklist={c} hoy={hoy} onAbrir={() => abrir(c.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead titulo="Validados hoy" bajada="Lo que ya aceptaste o rechazaste en el día." />
        {validadosHoy.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía ninguno.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {validadosHoy.map((c) => (
              <li key={c.id}>
                <FilaChecklist checklist={c} hoy={hoy} onAbrir={() => abrir(c.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DetalleChecklist id={abierto} onCerrar={() => abrir(null)} />
    </VistaUnica>
  );
}

function FilaChecklist({
  checklist: c,
  hoy,
  onAbrir,
}: {
  checklist: DailyChecklistSummary;
  hoy: string;
  onAbrir: () => void;
}) {
  return (
    <button
      className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-card px-3.5 py-3 text-left hover:border-foreground"
      type="button"
      onClick={onAbrir}
    >
      <span className="tabular text-[16px] font-bold">{c.equipment.internalCode}</span>
      <span className="text-[13px] text-muted-foreground">
        {c.mechanicName}
        {c.date !== hoy ? ` · ${fechaCorta(fromDateOnly(c.date))}` : ''} · {fmtTime(c.submittedAt)}
      </span>
      <span className="text-[13px] text-muted-foreground">
        · {c.maintained} con mantención · {c.photos} {c.photos === 1 ? 'foto' : 'fotos'}
      </span>
      <span className="ml-auto flex gap-1.5">
        {c.submissionCount > 1 && c.status === 'SUBMITTED' && <Chip tono="info">Corregido</Chip>}
        <Chip tono={CHECKLIST_ESTADO[c.status].tono}>{CHECKLIST_ESTADO[c.status].label}</Chip>
      </span>
    </button>
  );
}

function DetalleChecklist({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { data: c, isLoading } = useChecklistDetalle(id);
  return (
    <ModalTerreno
      abierto={!!id}
      detalle={c ? `${c.mechanicName} · ${fechaCorta(fromDateOnly(c.date))}` : undefined}
      titulo={c ? `Chequeo de ${c.equipment.internalCode}` : 'Chequeo'}
      onAbiertoChange={(v) => !v && onCerrar()}
    >
      {isLoading || !c ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <ContenidoDetalle checklist={c} onListo={onCerrar} />
      )}
    </ModalTerreno>
  );
}

function ContenidoDetalle({ checklist: c, onListo }: { checklist: DailyChecklistDetail; onListo: () => void }) {
  return (
    <ContenidoChecklist checklist={c}>
      {c.status === 'SUBMITTED' ? <Decision checklist={c} onListo={onListo} /> : <ResultadoRevision checklist={c} />}
    </ContenidoChecklist>
  );
}

/** Aceptar o rechazar. Rechazar exige decir qué corregir. */
function Decision({ checklist: c, onListo }: { checklist: DailyChecklistDetail; onListo: () => void }) {
  const { can } = usePermissions();
  const revisar = useReviewChecklist();
  const [comentario, setComentario] = useState('');
  const puedeRechazar = comentario.trim().length >= 3;

  if (!can('dailyChecklist.review')) {
    return (
      <p className="rounded-2xl bg-[var(--warning-soft)] px-3.5 py-3 text-[13.5px] font-semibold text-[var(--warning-soft-foreground)]">
        Solo el supervisor valida los chequeos: es quien prueba el equipo en terreno.
      </p>
    );
  }

  const decidir = (decision: 'ACCEPTED' | 'REJECTED') =>
    revisar.mutate(
      {
        id: c.id,
        input: {
          decision,
          submission: c.submissionCount,
          ...(comentario.trim() ? { comment: comentario.trim() } : {}),
        },
      },
      { onSuccess: onListo },
    );

  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col gap-3 border-t border-border bg-card px-4 py-4">
      <Campo hint="Obligatorio si lo rechazas: dile al mantenedor qué tiene que corregir." label="Comentario">
        <Textarea
          className="min-h-[72px]"
          placeholder="Ej.: falta la foto de las pastillas después del cambio"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </Campo>
      <div className="grid gap-2 sm:grid-cols-2">
        <Boton
          className="border-[1.5px] border-[var(--danger)] bg-card text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
          disabled={!puedeRechazar || revisar.isPending}
          title={puedeRechazar ? undefined : 'Escribe qué hay que corregir para rechazarlo'}
          variante="contorno"
          onClick={() => decidir('REJECTED')}
        >
          <CircleX className="h-5 w-5" aria-hidden /> Rechazar
        </Boton>
        <Boton
          className="bg-[#15803d] hover:bg-[#116932]"
          disabled={revisar.isPending}
          variante="acento"
          onClick={() => decidir('ACCEPTED')}
        >
          <CircleCheck className="h-5 w-5" aria-hidden /> Aceptar y liberar equipo
        </Boton>
      </div>
    </div>
  );
}
