import { useState } from 'react';
import { Circle } from 'lucide-react';

import { dependientesDe, type OutboxOp } from '../../offline/db';
import { discardOp, overwriteOp, retryOp } from '../../offline/outbox';
import type { Equipment } from '../../types/equipment';

/** Código del equipo desde el catálogo (el mismo que precarga "Preparar para
 * uso sin señal") — sin él la etiqueta queda genérica en vez de esperar una
 * request que, sin señal, no iba a llegar. */
function codigoEquipo(equipos: Equipment[] | undefined, equipoId: string): string | undefined {
  return equipos?.find((e) => e.id === equipoId)?.internalCode;
}

function labelOp(op: OutboxOp, equipos: Equipment[] | undefined): string {
  switch (op.type) {
    case 'openCard':
      return 'Apertura de tarjeta';
    case 'closeCard':
      return 'Cierre de tarjeta';
    case 'sendExitReport':
      return 'Reporte de salida';
    case 'createHallazgo': {
      const codigo = codigoEquipo(equipos, op.payload.equipoId);
      return codigo ? `Hallazgo · ${codigo}` : 'Hallazgo';
    }
    case 'createTrabajoExtra': {
      const codigo = codigoEquipo(equipos, op.payload.equipoId);
      return codigo ? `Trabajo extra · ${codigo}` : 'Trabajo extra';
    }
    case 'httpWrite':
      // La etiqueta la armó el registro de endpoints al encolar.
      return op.label;
  }
}

const BOTON = 'min-h-9 flex-1 rounded-lg border border-border text-[13px] font-semibold';

/**
 * Lista de lo que el servidor rechazó y espera una acción de la persona
 * (`needs_attention`): Reintentar, Sobrescribir (un `STALE_UPDATE`) o Descartar,
 * con el aviso de lo que depende de cada operación (`dependsOn`, transitivo):
 * `nextPendingOp` (`offline/replay.ts`) lo retiene sin mandarlo mientras siga en
 * atención, y `discardOp` (`offline/outbox.ts`) lo arrastra si se descarta.
 * Compartida por la hoja de Terreno y la de oficina.
 */
export function SyncOpsList({
  ops,
  userId,
  equipos,
}: {
  /** TODAS las operaciones del usuario: se filtran acá las que requieren atención
   * y se buscan entre todas sus dependientes. */
  ops: OutboxOp[];
  userId: string | undefined;
  equipos?: Equipment[];
}) {
  const [descartando, setDescartando] = useState<string | null>(null);
  const opsAtencion = ops.filter((op) => op.status === 'needs_attention');

  if (opsAtencion.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">Ningún registro requiere atención.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        Requieren atención
      </span>
      {opsAtencion.map((op) => {
        const deps = dependientesDe(op.id, ops);
        const dependiente = deps.find((o) => o.type === 'closeCard');
        const esStale = op.lastError?.code === 'STALE_UPDATE' && op.type === 'httpWrite';
        return (
          <div key={op.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold">{labelOp(op, equipos)}</span>
              <Circle className="mt-1 h-2 w-2 shrink-0 fill-[var(--danger)] text-[var(--danger)]" />
            </div>
            <p className="m-0 text-[13px] text-[var(--danger)]">
              {op.lastError?.message ?? 'El servidor rechazó esta operación.'}
            </p>
            {dependiente ? (
              <p className="m-0 text-[12.5px] text-muted-foreground">
                Esta tarjeta también tiene un cierre guardado (con foto): se envía solo cuando resuelvas la
                apertura.
              </p>
            ) : (
              deps.length > 0 && (
                <p className="m-0 text-[12.5px] text-muted-foreground">
                  Hay {deps.length === 1 ? '1 cambio guardado' : `${deps.length} cambios guardados`} que dependen
                  de este: se envían cuando lo resuelvas.
                </p>
              )
            )}
            {descartando === op.id ? (
              <div className="flex flex-col gap-2 rounded-xl bg-[var(--danger-soft)] p-2.5">
                <span className="text-[12.5px] font-semibold text-[var(--danger)]">
                  {dependiente
                    ? 'Se descarta la apertura y también su cierre guardado con la foto. No se puede deshacer.'
                    : deps.length > 0
                      ? 'Se descarta este registro y los cambios guardados que dependen de él. No se puede deshacer.'
                      : '¿Descartar? No se puede deshacer.'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (userId) void discardOp(op.id, userId);
                      setDescartando(null);
                    }}
                    className="min-h-9 flex-1 rounded-lg bg-[var(--danger)] text-[13px] font-semibold text-white"
                  >
                    Sí, descartar
                  </button>
                  <button type="button" onClick={() => setDescartando(null)} className={BOTON}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {esStale ? (
                  <button
                    type="button"
                    onClick={() => userId && void overwriteOp(op.id, userId)}
                    className={BOTON}
                  >
                    Sobrescribir
                  </button>
                ) : (
                  <button type="button" onClick={() => userId && void retryOp(op.id, userId)} className={BOTON}>
                    Reintentar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDescartando(op.id)}
                  className={`${BOTON} text-[var(--danger)]`}
                >
                  Descartar
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
