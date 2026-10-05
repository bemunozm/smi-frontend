import { CheckCircle2, XCircle } from 'lucide-react';

import type { PrepKey } from '../../config/offline-prep';
import { usePrepareOffline } from '../../hooks/usePrepareOffline';
import type { Role } from '../../types/roles';

const ETIQUETAS: Record<PrepKey, string> = {
  equipment: 'Equipos precargados',
  branches: 'Sucursales precargadas',
  operators: 'Operadores precargados',
  inventory: 'Inventario precargado',
  maintenance: 'Mantenimiento precargado',
  shiftCards: 'Tarjetas propias precargadas',
  hallazgos: 'Hallazgos precargados',
  trabajosExtra: 'Trabajos extra precargados',
  horometro: 'Equipos en turno precargados',
};

const ORDEN: readonly PrepKey[] = [
  'equipment',
  'branches',
  'operators',
  'inventory',
  'maintenance',
  'shiftCards',
  'hallazgos',
  'trabajosExtra',
  'horometro',
];

function PrepItemRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success-soft-foreground)]" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" />
      )}
      {children}
    </div>
  );
}

/**
 * "Preparar para uso sin señal": el botón y el checklist de lo que quedó guardado
 * en el equipo para el rol. Lo comparten la hoja de Terreno y la de oficina.
 */
export function PrepChecklist({ role, titulo, descripcion }: { role: Role | null; titulo: string; descripcion: string }) {
  const { preparando, resultadoPrep, handlePreparar } = usePrepareOffline(role);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3.5">
      <span className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{titulo}</span>
      <p className="m-0 text-[13px] text-muted-foreground">{descripcion}</p>
      <button
        type="button"
        disabled={preparando}
        onClick={() => void handlePreparar()}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {preparando ? 'Preparando…' : 'Preparar para uso sin señal'}
      </button>

      {resultadoPrep && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-[#fafbfc] p-3">
          <PrepItemRow ok={resultadoPrep.persist === 'ok'}>Almacenamiento reservado</PrepItemRow>
          {ORDEN.map((key) => {
            const estado = resultadoPrep[key];
            return estado ? (
              <PrepItemRow key={key} ok={estado === 'ok'}>
                {ETIQUETAS[key]}
              </PrepItemRow>
            ) : null;
          })}
          {!resultadoPrep.installed && (
            <p className="m-0 mt-1 text-[12.5px] font-medium text-[var(--warning-soft-foreground)]">
              Instalá la app en la pantalla de inicio: en iPad, Safari borra los datos guardados de las páginas
              no instaladas después de 7 días sin uso.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
