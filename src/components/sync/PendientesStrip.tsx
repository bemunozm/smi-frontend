import { AlertTriangle, Clock } from 'lucide-react';

import { usePendingWrites } from '../../hooks/usePendingWrites';
import { plural } from '../../lib/format';
import type { EndpointResource } from '../../lib/pending-resources';

/**
 * Franja de "N cambios sin sincronizar" para arriba de una lista de oficina. Las
 * listas NO muestran filas optimistas (lo guardado sin señal no se mezcla con lo
 * que el servidor confirmó), pero sin ningún rastro alguien volvería a crear algo
 * que ya creó: acá se ve qué espera, con su etiqueta, y si algo requiere atención.
 * No dibuja nada cuando no hay nada esperando.
 *
 * `recursos`: qué escrituras corresponden a la vista (ver `usePendingWrites`).
 */
export function PendientesStrip({ recursos }: { recursos: readonly EndpointResource[] }) {
  const { ops, pendientes, atencion } = usePendingWrites(recursos);
  if (ops.length === 0) return null;

  const tono =
    atencion > 0 ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground';
  const Icono = atencion > 0 ? AlertTriangle : Clock;

  return (
    <div role="status" className={`flex flex-col gap-2 rounded-xl px-3.5 py-2.5 text-sm ${tono}`}>
      <span className="flex items-center gap-2 font-semibold">
        <Icono aria-hidden className="h-4 w-4 shrink-0" />
        {plural(ops.length, 'cambio', 'cambios')} sin sincronizar
      </span>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {ops.map((op) => (
          <li
            key={op.id}
            className="rounded-full bg-white/60 px-2.5 py-0.5 text-[12.5px] font-medium dark:bg-black/20"
          >
            {op.label}
          </li>
        ))}
      </ul>
      {atencion > 0 ? (
        <span className="text-[12.5px] font-semibold">
          {plural(atencion, 'cambio requiere', 'cambios requieren')} atención · ver Sincronización
          {pendientes > 0 ? ` (${pendientes} esperando señal)` : ''}
        </span>
      ) : (
        <span className="text-[12.5px]">Se enviarán solos cuando haya señal.</span>
      )}
    </div>
  );
}
