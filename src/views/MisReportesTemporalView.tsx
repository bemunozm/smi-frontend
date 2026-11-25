import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { DetalleInformeTemporal, fechaLegible } from '../components/temporal/DetalleInformeTemporal';
import { MarcaSinSincronizar } from '../components/terreno/MarcaSinSincronizar';
import { Card, CardHead, Hoja, VistaHead, VistaUnica } from '../components/terreno/ui';
import { turnoLabel } from '../config/flota-colors';
import { useMisInformesProjection, type InformePendiente } from '../hooks/useMisInformesProjection';
import { plural } from '../lib/format';
import type { InformeTemporal } from '../types/informe-temporal';

const actividadesDe = (i: { actividad1: string; actividad2: string | null }) =>
  [i.actividad1, i.actividad2].filter(Boolean).join(' · ');

/** Un informe que sigue en la cola: sin número todavía y sin detalle. */
function FilaPendiente({ informe }: { informe: InformePendiente }) {
  return (
    <li
      className="flex flex-col gap-1 rounded-2xl border border-border px-3.5 py-3"
      data-testid={`mi-informe-pendiente-${informe.id}`}
    >
      <span className="tabular text-[15px] font-bold text-foreground">
        {fechaLegible(informe.fecha)} · {turnoLabel(informe.turno)}
      </span>
      <span className="text-[13.5px] text-foreground">{actividadesDe(informe)}</span>
      <span className="text-[13px] text-[var(--label-color)]">{plural(informe.equipos, 'equipo', 'equipos')}</span>
      <MarcaSinSincronizar requiereAtencion={informe.requiereAtencion} />
    </li>
  );
}

function FilaInforme({ informe, onAbrir }: { informe: InformeTemporal; onAbrir: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Ver informe N° ${informe.numero}`}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border px-3.5 py-3 text-left hover:bg-default"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="tabular text-[15px] font-bold text-foreground">
            #{informe.numero} · {fechaLegible(informe.fecha)} · {turnoLabel(informe.turno)}
          </span>
          <span className="text-[13.5px] text-foreground">{actividadesDe(informe)}</span>
          <span className="text-[13px] text-[var(--label-color)]">
            {plural(informe.tarjetas.length, 'equipo', 'equipos')}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

/**
 * «Mis reportes» del supervisor temporal: los informes que envió, del más
 * nuevo al más viejo, y arriba los que siguen en la cola del equipo (con la
 * marca «Sin sincronizar»). Tocar uno abre su detalle en una hoja, solo de
 * lectura: corregir o eliminar un informe es de oficina.
 */
export function MisReportesTemporalView() {
  const { informes, pendientes, isPending, isError, error } = useMisInformesProjection();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = informes.find((i) => i.id === abiertoId) ?? null;

  const total = informes.length + pendientes.length;
  const hayAlgo = total > 0;

  return (
    <VistaUnica>
      <VistaHead titulo="Mis reportes" />
      <Card>
        <CardHead
          titulo="Informes enviados"
          bajada={hayAlgo ? plural(total, 'informe', 'informes') : 'Los informes que generas al cerrar tus equipos.'}
        />
        {pendientes.length > 0 && (
          <ul className="m-0 mb-3 flex list-none flex-col gap-2.5 p-0" aria-label="Informes sin sincronizar">
            {pendientes.map((p) => (
              <FilaPendiente key={p.id} informe={p} />
            ))}
          </ul>
        )}
        {isPending && pendientes.length === 0 ? (
          <p className="m-0 py-4 text-center text-sm text-muted-foreground">Cargando tus reportes…</p>
        ) : isError ? (
          <p className="m-0 text-sm text-[var(--danger-soft-foreground)]" role="alert">
            {error instanceof Error ? error.message : 'No se pudieron cargar tus reportes.'}
          </p>
        ) : !hayAlgo ? (
          <p className="m-0 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-[var(--label-color)]">
            Aún no has enviado reportes.
          </p>
        ) : (
          informes.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Informes enviados">
              {informes.map((i) => (
                <FilaInforme key={i.id} informe={i} onAbrir={() => setAbiertoId(i.id)} />
              ))}
            </ul>
          )
        )}
      </Card>

      {abierto && (
        <Hoja
          eyebrow="Mis reportes"
          titulo={`Informe N° ${abierto.numero}`}
          bajada={`${fechaLegible(abierto.fecha)} · ${turnoLabel(abierto.turno)}`}
          onCerrar={() => setAbiertoId(null)}
        >
          <DetalleInformeTemporal informe={abierto} />
        </Hoja>
      )}
    </VistaUnica>
  );
}
