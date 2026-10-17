import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleX, ImageOff } from 'lucide-react';

import {
  Boton,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  Filas,
  GrupoHead,
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
import { fmtNum, fmtTime } from '../lib/format';
import { fechaCorta, fromDateOnly, toDateOnly } from '../lib/turno';
import type { DailyChecklistDetail, DailyChecklistSummary } from '../types/daily-checklist';

const POR_VALIDAR = ['SUBMITTED'] as const;

const ESTADO: Record<DailyChecklistSummary['status'], { label: string; tono: 'warning' | 'success' | 'danger' }> = {
  SUBMITTED: { label: 'Por validar', tono: 'warning' },
  ACCEPTED: { label: 'Aceptado', tono: 'success' },
  REJECTED: { label: 'Rechazado', tono: 'danger' },
};

/**
 * Módulo 3 · R25 — validación del supervisor. El mantenedor hace el checklist
 * (por lo general en la colación) y el supervisor, al volver, prueba el
 * equipo y mira lo declarado: si está todo bien lo acepta y el equipo queda
 * liberado para abrir turno; si no, lo rechaza con lo que hay que corregir y
 * vuelve al mantenedor.
 *
 * `?id=` abre un checklist directo (el aviso de la notificación lleva acá).
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
      <VistaHead titulo="Checklists por validar" contexto={<ChipContexto>{fechaCorta(new Date())}</ChipContexto>} />

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
            Nada por validar. Cuando el mantenedor envíe un checklist, aparece acá.
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
        <Chip tono={ESTADO[c.status].tono}>{ESTADO[c.status].label}</Chip>
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
      titulo={c ? `Checklist de ${c.equipment.internalCode}` : 'Checklist'}
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
  const mantenciones = c.entries.filter((e) => e.status === 'MAINTAINED');
  const revisados = c.entries.filter((e) => e.status === 'CHECKED');
  const noRevisados = c.entries.filter((e) => e.status === 'NOT_CHECKED');
  const rechazos = c.reviews.filter((r) => r.decision === 'REJECTED');

  return (
    <>
      <Filas
        filas={[
          ['Estado', <Chip key="estado" tono={ESTADO[c.status].tono}>{ESTADO[c.status].label}</Chip>],
          ['Horómetro / odómetro', <span key="contador" className="tabular">{fmtNum(c.counter)}</span>],
          ['Enviado', `${fmtTime(c.submittedAt)}${c.submissionCount > 1 ? ` · envío ${c.submissionCount}` : ''}`],
          [
            'Declarado',
            `${c.maintained} con mantención · ${revisados.length} revisados · ${noRevisados.length} sin revisar`,
          ],
        ]}
      />

      {rechazos.length > 0 && (
        <div className="rounded-2xl bg-[var(--warning-soft)] px-3.5 py-3 text-[13.5px] text-[var(--warning-soft-foreground)]">
          {rechazos.map((r) => (
            <p key={r.createdAt}>
              <strong>
                Rechazado por {r.reviewerName} ({fmtTime(r.createdAt)}):
              </strong>{' '}
              {r.comment}
            </p>
          ))}
        </div>
      )}

      <GrupoHead titulo="Se hizo mantención" detalle={`${mantenciones.length}`} />
      {mantenciones.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">Ninguna mantención: solo revisión.</p>
      ) : (
        mantenciones.map((e) => (
          <div key={e.itemName} className="flex flex-col gap-2 rounded-2xl border border-border px-3.5 py-3">
            <p className="text-[15px] font-bold">{e.itemName}</p>
            <p className="text-[14px]">{e.description}</p>
            {e.supplies.length > 0 && (
              <p className="text-[13px] text-muted-foreground">
                Insumos: {e.supplies.map((s) => `${s.name} (${s.sku}) × ${fmtNum(s.quantity)}`).join(', ')}
              </p>
            )}
            {e.temperature != null && <p className="text-[13px]">Temperatura: {fmtNum(e.temperature)} °C</p>}
            {e.note && <p className="text-[13px] text-muted-foreground">Nota: {e.note}</p>}
            <Fotos fotos={e.photos} />
          </div>
        ))
      )}

      <GrupoHead titulo="Se revisó" detalle={`${revisados.length}`} />
      {revisados.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">Ninguno.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {revisados.map((e) => (
            <li key={e.itemName} className="flex flex-col gap-1.5 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[14.5px] font-medium">
                <CircleCheck className="h-4 w-4 text-[#15803d]" aria-hidden />
                {e.itemName}
              </span>
              {e.note && <span className="text-[13px] text-muted-foreground">Nota: {e.note}</span>}
              {e.temperature != null && <span className="text-[13px]">Temperatura: {fmtNum(e.temperature)} °C</span>}
              {e.photos.length > 0 && <Fotos fotos={e.photos} />}
            </li>
          ))}
        </ul>
      )}

      {noRevisados.length > 0 && (
        <>
          <GrupoHead titulo="No se revisó" detalle={`${noRevisados.length}`} />
          <p className="text-[13.5px] text-muted-foreground">{noRevisados.map((e) => e.itemName).join(', ')}.</p>
        </>
      )}

      {c.status === 'SUBMITTED' ? <Decision checklist={c} onListo={onListo} /> : <ResultadoRevision checklist={c} />}
    </>
  );
}

function Fotos({ fotos }: { fotos: { id: string; url: string }[] }) {
  if (fotos.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <ImageOff className="h-4 w-4" aria-hidden /> Sin fotos
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map((f, i) => (
        <a
          key={f.id}
          aria-label={`Abrir foto ${i + 1}`}
          className="block h-24 w-24 overflow-hidden rounded-xl border border-border"
          href={f.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <img alt={`Foto ${i + 1}`} className="h-full w-full object-cover" src={f.url} />
        </a>
      ))}
    </div>
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
        Solo el supervisor valida los checklists: es quien prueba el equipo en terreno.
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

function ResultadoRevision({ checklist: c }: { checklist: DailyChecklistDetail }) {
  const ultima = c.reviews.at(-1);
  if (c.status === 'REJECTED') {
    return (
      <p className="rounded-2xl bg-[var(--danger-soft)] px-3.5 py-3 text-[13.5px] text-[var(--danger-soft-foreground)]">
        Rechazado{ultima ? ` por ${ultima.reviewerName} a las ${fmtTime(ultima.createdAt)}` : ''}. Espera a que el
        mantenedor lo corrija y lo reenvíe.
      </p>
    );
  }
  return (
    <p className="rounded-2xl bg-[var(--success-soft)] px-3.5 py-3 text-[13.5px] text-[var(--success-soft-foreground)]">
      Aceptado{ultima ? ` por ${ultima.reviewerName} a las ${fmtTime(ultima.createdAt)}` : ''}: el equipo quedó
      liberado.
      {ultima?.comment ? ` «${ultima.comment}»` : ''}
    </p>
  );
}
