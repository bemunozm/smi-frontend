import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { DetalleInformeTemporal, fechaLegible } from './DetalleInformeTemporal';
import { MarcaSinSincronizar } from '../terreno/MarcaSinSincronizar';
import { Boton, Card, CardHead, Hoja } from '../terreno/ui';
import { turnoLabel } from '../../config/flota-colors';
import { useMisInformesProjection, type InformePendiente } from '../../hooks/useMisInformesProjection';
import { plural } from '../../lib/format';
import type { InformeTemporal } from '../../types/informe-temporal';

/** Cuántos informes muestra la tarjeta; el resto, en «Ver historial completo». */
export const HISTORIAL_VISIBLES = 5;

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

/** Los pendientes (arriba) y los enviados, cada uno en su lista. */
function ListaInformes({
  pendientes,
  informes,
  onAbrir,
}: {
  pendientes: readonly InformePendiente[];
  informes: readonly InformeTemporal[];
  onAbrir: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {pendientes.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Informes sin sincronizar">
          {pendientes.map((p) => (
            <FilaPendiente key={p.id} informe={p} />
          ))}
        </ul>
      )}
      {informes.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Informes enviados">
          {informes.map((i) => (
            <FilaInforme key={i.id} informe={i} onAbrir={() => onAbrir(i.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * «Historial de reportes» del supervisor temporal, dentro de «Mis equipos»: los
 * informes más recientes (arriba los que siguen en la cola, con la marca «Sin
 * sincronizar») y, si hay más, «Ver historial completo» en una hoja. Tocar un
 * informe enviado abre su detalle, solo de lectura: corregir o eliminar es de
 * oficina. Su estado es propio y no toca el formulario de cierre de la vista.
 */
export function HistorialReportes() {
  const { informes, pendientes, isPending, isError, error } = useMisInformesProjection();
  const [verTodo, setVerTodo] = useState(false);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = informes.find((i) => i.id === abiertoId) ?? null;

  const total = informes.length + pendientes.length;
  // Los primeros cinco del total: los pendientes van primero.
  const pendientesVisibles = pendientes.slice(0, HISTORIAL_VISIBLES);
  const informesVisibles = informes.slice(0, Math.max(0, HISTORIAL_VISIBLES - pendientesVisibles.length));

  return (
    <>
      <Card>
        <CardHead
          titulo="Historial de reportes"
          bajada={total > 0 ? plural(total, 'informe', 'informes') : 'Los informes que generas al cerrar tus equipos.'}
        />
        {isPending && pendientes.length === 0 ? (
          <p className="m-0 py-4 text-center text-sm text-muted-foreground">Cargando tus reportes…</p>
        ) : isError && pendientes.length === 0 ? (
          <p className="m-0 text-sm text-[var(--danger-soft-foreground)]" role="alert">
            {error instanceof Error ? error.message : 'No se pudieron cargar tus reportes.'}
          </p>
        ) : total === 0 ? (
          <p className="m-0 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-[var(--label-color)]">
            Aún no has enviado reportes.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <ListaInformes pendientes={pendientesVisibles} informes={informesVisibles} onAbrir={setAbiertoId} />
            {total > HISTORIAL_VISIBLES && (
              <Boton variante="contorno" ancho onClick={() => setVerTodo(true)}>
                Ver historial completo ({total})
              </Boton>
            )}
          </div>
        )}
      </Card>

      {/* Con un detalle abierto la hoja del historial se oculta y vuelve al cerrarlo. */}
      {verTodo && !abierto && (
        <Hoja
          eyebrow="Mis equipos"
          titulo="Historial de reportes"
          bajada={plural(total, 'informe', 'informes')}
          onCerrar={() => setVerTodo(false)}
        >
          <ListaInformes pendientes={pendientes} informes={informes} onAbrir={setAbiertoId} />
        </Hoja>
      )}
      {abierto && (
        <Hoja
          eyebrow="Historial de reportes"
          titulo={`Informe N° ${abierto.numero}`}
          bajada={`${fechaLegible(abierto.fecha)} · ${turnoLabel(abierto.turno)}`}
          onCerrar={() => setAbiertoId(null)}
        >
          <DetalleInformeTemporal informe={abierto} />
        </Hoja>
      )}
    </>
  );
}
