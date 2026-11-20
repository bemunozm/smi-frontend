import type { ReactNode } from 'react';
import { CircleCheck, ImageOff } from 'lucide-react';

import { Chip, Filas, GrupoHead } from '../terreno/ui';
import { CHECKLIST_ESTADO, contadorChecklist } from './checklist-estado';
import { fmtNum, fmtTime } from '../../lib/format';
import type { DailyChecklistDetail } from '../../types/daily-checklist';

/**
 * El detalle de un chequeo (estado, contador, lo declarado ítem por ítem y las
 * fotos), compartido por el supervisor (`ValidarChecklistsView`, que le suma su
 * decisión) y el panel del administrador (`ChequeosDiariosAdminView`, solo
 * lectura). Lo que va al pie (aceptar/rechazar o el resultado) lo pone quien lo
 * usa en `children`.
 */
export function ContenidoChecklist({
  checklist: c,
  children,
}: {
  checklist: DailyChecklistDetail;
  children?: ReactNode;
}) {
  const mantenciones = c.entries.filter((e) => e.status === 'MAINTAINED');
  const revisados = c.entries.filter((e) => e.status === 'CHECKED');
  const noRevisados = c.entries.filter((e) => e.status === 'NOT_CHECKED');
  const rechazos = c.reviews.filter((r) => r.decision === 'REJECTED');

  return (
    <>
      <Filas
        filas={[
          ['Estado', <Chip key="estado" tono={CHECKLIST_ESTADO[c.status].tono}>{CHECKLIST_ESTADO[c.status].label}</Chip>],
          ['Horómetro / odómetro', <span key="contador" className="tabular">{contadorChecklist(c)}</span>],
          ['Enviado', `${fmtTime(c.submittedAt)}${c.submissionCount > 1 ? ` · envío ${c.submissionCount}` : ''}`],
          [
            'Declarado',
            `${c.maintained} con mantención · ${revisados.length} revisados y operativos · ${noRevisados.length} sin revisar`,
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

      {children}
    </>
  );
}

export function Fotos({ fotos }: { fotos: { id: string; url: string }[] }) {
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

/** Quién validó el chequeo y cuándo (aceptado o rechazado). */
export function ResultadoRevision({ checklist: c }: { checklist: DailyChecklistDetail }) {
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
