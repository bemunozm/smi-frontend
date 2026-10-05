import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@heroui/react';

import { PREP_KEYS, type PrepKey } from '../../config/offline-prep';
import { usePrepareOffline } from '../../hooks/usePrepareOffline';
import type { Role } from '../../types/roles';

/** Lo que la precarga NO cubre — se muestra junto al botón para que nadie lo
 * descubra sin señal. */
export const PREP_DETAIL_LIMITATION =
  'La ficha y el detalle de cada equipo, y el kardex de cada ítem, no se precargan: abren sin señal solo si ya los visitaste con conexión.';

const ETIQUETAS: Record<PrepKey, string> = {
  dashboard: 'Panel (resumen de flota) precargado',
  equipment: 'Equipos precargados',
  branches: 'Sucursales precargadas',
  operators: 'Operadores precargados',
  inventory: 'Inventario precargado',
  movimientos: 'Movimientos de inventario precargados',
  maintenance: 'Mantenimiento precargado',
  bitacora: 'Bitácora de las órdenes recientes precargada',
  notificaciones: 'Notificaciones precargadas',
  shiftCards: 'Tarjetas propias precargadas',
  hallazgos: 'Hallazgos precargados',
  trabajosExtra: 'Trabajos extra precargados',
  horometro: 'Equipos en turno precargados',
  combustible: 'Cargas de combustible precargadas',
};

type Estado = 'ok' | 'error' | 'aviso';

function PrepItemRow({ estado, children }: { estado: Estado; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground">
      {estado === 'ok' && <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-success" />}
      {estado === 'error' && <XCircle aria-hidden className="h-4 w-4 shrink-0 text-danger" />}
      {estado === 'aviso' && <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-warning" />}
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
      <Button isDisabled={preparando} variant="secondary" className="min-h-12" onPress={() => void handlePreparar()}>
        {preparando ? 'Preparando…' : 'Preparar para uso sin señal'}
      </Button>

      {resultadoPrep && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-secondary p-3">
          <PrepItemRow estado={resultadoPrep.serviceWorker === 'ok' ? 'ok' : 'error'}>
            Modo sin señal activo en esta pantalla
          </PrepItemRow>
          {resultadoPrep.serviceWorker !== 'ok' && (
            <p className="m-0 text-[12.5px] font-medium text-warning-soft-foreground">
              Todavía no se guardó nada para usar sin señal: recargá la app una vez, con conexión, y volvé a preparar.
            </p>
          )}
          <PrepItemRow estado={resultadoPrep.persist === 'ok' ? 'ok' : 'aviso'}>Almacenamiento reservado</PrepItemRow>
          {PREP_KEYS.map((key) => {
            const estado = resultadoPrep[key];
            return estado ? (
              <PrepItemRow key={key} estado={estado}>
                {ETIQUETAS[key]}
              </PrepItemRow>
            ) : null;
          })}
          {!resultadoPrep.installed && (
            <p className="m-0 mt-1 text-[12.5px] font-medium text-warning-soft-foreground">
              Instalá la app en la pantalla de inicio: en iPad, Safari borra los datos guardados de las páginas
              no instaladas después de 7 días sin uso.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
