import { useState } from 'react';
import { Circle } from 'lucide-react';
import { Button } from '@heroui/react';

import { FORBIDDEN_MESSAGE } from '../../lib/error-messages';
import { arrastradasAlDescartar, type OutboxOp } from '../../offline/db';
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

/** En qué está una operación que todavía no terminó y no espera una acción. */
function estadoEnCola(op: OutboxOp): string {
  if (op.status === 'syncing') return 'Enviando…';
  const intentos = op.attempts > 0 ? ` · ${op.attempts === 1 ? '1 intento' : `${op.attempts} intentos`}` : '';
  return `${op.lastError ? 'Reintentando solo' : 'Esperando señal'}${intentos}`;
}

function CuadroDescartar({
  op,
  ops,
  onCancel,
  onConfirm,
}: {
  op: OutboxOp;
  ops: OutboxOp[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dependientes = arrastradasAlDescartar(op.id, ops);
  const hayCierre = dependientes.some((o) => o.type === 'closeCard');
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-danger-soft p-2.5">
      <span className="text-[12.5px] font-semibold text-danger-soft-foreground">
        {hayCierre
          ? 'Se descarta la apertura y también su cierre guardado con la foto. No se puede deshacer.'
          : dependientes.length > 0
            ? 'Se descarta este registro y los cambios guardados que dependen de él. No se puede deshacer.'
            : '¿Descartar? No se puede deshacer.'}
      </span>
      <div className="flex gap-2">
        <Button className="flex-1" size="sm" variant="danger" onPress={onConfirm}>
          Sí, descartar
        </Button>
        <Button className="flex-1" size="sm" variant="tertiary" onPress={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function AvisoDependientes({ op, ops }: { op: OutboxOp; ops: OutboxOp[] }) {
  const dependientes = arrastradasAlDescartar(op.id, ops);
  if (dependientes.length === 0) return null;
  if (dependientes.some((o) => o.type === 'closeCard')) {
    return (
      <p className="m-0 text-[12.5px] text-muted-foreground">
        Esta tarjeta también tiene un cierre guardado (con foto): se envía solo cuando resuelvas la apertura.
      </p>
    );
  }
  return (
    <p className="m-0 text-[12.5px] text-muted-foreground">
      Hay {dependientes.length === 1 ? '1 cambio guardado' : `${dependientes.length} cambios guardados`} que dependen
      de este: se envían cuando lo resuelvas.
    </p>
  );
}

const ENCABEZADO = 'text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase';

/**
 * Lo que el equipo tiene guardado del usuario y todavía no llegó al servidor,
 * con su estado y su último error — nada queda atascado sin que se vea:
 * - "Requieren atención" (`needs_attention`): el servidor las rechazó. Reintentar,
 *   Sobrescribir (un `STALE_UPDATE`) o Descartar. `nextPendingOp`
 *   (`offline/replay.ts`) retiene sin mandar lo que depende de cada una mientras
 *   siga en atención.
 * - "En cola": todo lo demás (esperando señal, reintentándose, enviándose). Se
 *   puede Descartar cualquiera que no esté en vuelo: una operación que falla por
 *   algo que ningún reintento arregla no puede quedar sin salida.
 * Descartar avisa lo que depende de la operación (`dependsOn`, transitivo) y
 * `discardOp` (`offline/outbox.ts`) lo arrastra. Compartida por la hoja de Terreno
 * y la de oficina.
 */
export function SyncOpsList({
  ops,
  userId,
  equipos,
}: {
  /** TODAS las operaciones del usuario, en el orden en que se mandarán. */
  ops: OutboxOp[];
  userId: string | undefined;
  equipos?: Equipment[];
}) {
  const [descartando, setDescartando] = useState<string | null>(null);
  const opsAtencion = ops.filter((op) => op.status === 'needs_attention');
  const opsEnCola = ops.filter((op) => op.status !== 'needs_attention');

  const confirmarDescarte = (op: OutboxOp): void => {
    if (userId) void discardOp(op.id, userId);
    setDescartando(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {opsAtencion.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Ningún registro requiere atención.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className={ENCABEZADO}>Requieren atención</span>
          {opsAtencion.map((op) => {
            const sinPermiso = op.lastError?.status === 403;
            const esStale = op.lastError?.code === 'STALE_UPDATE' && op.type === 'httpWrite';
            return (
              <div key={op.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{labelOp(op, equipos)}</span>
                  <Circle aria-hidden className="mt-1 h-2 w-2 shrink-0 fill-danger text-danger" />
                </div>
                <p className="m-0 text-[13px] text-danger">
                  {sinPermiso
                    ? FORBIDDEN_MESSAGE
                    : (op.lastError?.message ?? 'El servidor rechazó esta operación.')}
                </p>
                <AvisoDependientes op={op} ops={ops} />
                {descartando === op.id ? (
                  <CuadroDescartar
                    op={op}
                    ops={ops}
                    onCancel={() => setDescartando(null)}
                    onConfirm={() => confirmarDescarte(op)}
                  />
                ) : (
                  <div className="flex gap-2">
                    {sinPermiso ? null : esStale ? (
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="outline"
                        onPress={() => userId && void overwriteOp(op.id, userId)}
                      >
                        Sobrescribir
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="outline"
                        onPress={() => userId && void retryOp(op.id, userId)}
                      >
                        Reintentar
                      </Button>
                    )}
                    <Button className="flex-1" size="sm" variant="danger-soft" onPress={() => setDescartando(op.id)}>
                      Descartar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {opsEnCola.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className={ENCABEZADO}>En cola</span>
          {opsEnCola.map((op) => (
            <div key={op.id} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
              <span className="text-sm font-semibold text-foreground">{labelOp(op, equipos)}</span>
              <p className="m-0 text-[12.5px] text-muted-foreground">{estadoEnCola(op)}</p>
              {op.lastError && op.status !== 'syncing' && (
                <p className="m-0 text-[12.5px] text-warning-soft-foreground">{op.lastError.message}</p>
              )}
              {op.status !== 'syncing' &&
                (descartando === op.id ? (
                  <CuadroDescartar
                    op={op}
                    ops={ops}
                    onCancel={() => setDescartando(null)}
                    onConfirm={() => confirmarDescarte(op)}
                  />
                ) : (
                  <div className="flex">
                    <Button className="flex-1" size="sm" variant="danger-soft" onPress={() => setDescartando(op.id)}>
                      Descartar
                    </Button>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
