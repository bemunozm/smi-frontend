import { useMemo, useState } from 'react';
import { Check, CircleCheck, Plus, Trash2, Wrench } from 'lucide-react';

import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import {
  Automatico,
  Automaticos,
  Boton,
  Campo,
  Chip,
  ChipEstado,
  Input,
  Label,
  ModalTerreno,
  SelectorBuscable,
  Textarea,
} from '../terreno/ui';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';
import { useCompletarTarea } from '../../hooks/useOrdenes';
import type { OrdenTrabajo, Tarea } from '../../types/mantenimiento';
import { equipmentLabel, formatDate, type EquipmentRef } from './workshop';
import { useInsumosFaena } from './insumos-faena';

const ESTADO_HEX: Record<string, string> = {
  PENDIENTE: '#92590a',
  ASIGNADA: '#1a3a9c',
  EN_PROCESO: '#1a3a9c',
  COMPLETADA: '#156237',
  CANCELADA: '#971414',
};

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ASIGNADA: 'Asignada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

/** «2 de 3 tareas» — el avance del checklist de la orden preventiva. */
export function tareasHechas(orden: Pick<OrdenTrabajo, 'tareas'>): { hechas: number; total: number } {
  return {
    hechas: orden.tareas.filter((t) => t.hecha).length,
    total: orden.tareas.length,
  };
}

/**
 * Una tarea ya completada. Plegada muestra solo qué era; «Ver detalle» abre
 * la evidencia completa: cuándo se hizo, quién, qué se hizo y la foto.
 */
function TareaHecha({ tarea }: { tarea: Tarea }) {
  const [verDetalle, setVerDetalle] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-[var(--success-soft)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success-soft-foreground)]" />
          <span className="text-sm font-semibold text-[var(--success-soft-foreground)]">
            {tarea.texto}
          </span>
        </div>
        <button
          className="shrink-0 cursor-pointer text-[13px] font-semibold underline"
          type="button"
          onClick={() => setVerDetalle((v) => !v)}
        >
          {verDetalle ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>
      {verDetalle ? (
        <div className="flex flex-col gap-2 ps-6 text-[13px] leading-5">
          <div className="flex flex-col gap-0.5">
            {tarea.hechaAt ? (
              <span>
                <strong className="font-semibold">Realizada:</strong>{' '}
                <span className="tabular">{formatDate(tarea.hechaAt)}</span>
              </span>
            ) : null}
            {tarea.hechaPorNombre ? (
              <span>
                <strong className="font-semibold">Por:</strong> {tarea.hechaPorNombre}
              </span>
            ) : null}
            {tarea.notas ? (
              <span>
                <strong className="font-semibold">¿Qué se hizo?</strong> {tarea.notas}
              </span>
            ) : null}
          </div>
          {tarea.fotoUrl ? (
            <a href={tarea.fotoUrl} rel="noreferrer" target="_blank">
              <img
                alt={`Foto de respaldo de ${tarea.texto}`}
                className="max-h-48 rounded-xl border border-border object-cover"
                src={tarea.fotoUrl}
              />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface FilaInsumo {
  insumoId: string;
  cantidad: string;
}

/**
 * El formulario de UNA tarea del checklist: qué se hizo + foto de respaldo
 * (obligatorias — deja evidencia, no solo un ticket) + los insumos usados en
 * ESTA tarea, que el backend descuenta del stock de Faena al guardar. Vive
 * como componente propio para que el flujo de foto nazca y muera con la
 * tarea que se está completando.
 */
function TareaForm({
  orden,
  tarea,
  onListo,
}: {
  orden: OrdenTrabajo;
  tarea: Tarea;
  onListo: () => void;
}) {
  const completar = useCompletarTarea();
  const { faenaBranch, opcionesInsumo } = useInsumosFaena();
  const [notas, setNotas] = useState('');
  const [insumos, setInsumos] = useState<FilaInsumo[]>([]);
  const foto = usePhotoCaptureFlow(() => {}, { ocr: false });

  const filasValidas = insumos.every(
    (fila) => fila.insumoId !== '' && Number(fila.cantidad) > 0,
  );
  const lista =
    notas.trim().length > 0 &&
    foto.file != null &&
    filasValidas &&
    (insumos.length === 0 || faenaBranch != null);

  const editarFila = (index: number, cambio: Partial<FilaInsumo>): void => {
    setInsumos((filas) => filas.map((fila, i) => (i === index ? { ...fila, ...cambio } : fila)));
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-[var(--accent)] bg-white p-3.5">
      <span className="text-sm font-semibold">{tarea.texto}</span>
      <Campo label="¿Qué se hizo?" requerido>
        <Textarea
          placeholder="Ej. Se cambió el aceite 15W-40 y se revisó el nivel"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </Campo>
      <FotoRespaldoField
        captureDate={foto.captureDate}
        file={foto.file}
        guia="Encuadra el trabajo terminado, con luz."
        isReadingPhoto={foto.isReadingPhoto}
        requerida
        staleQuestion="¿Es la foto de esta tarea recién hecha?"
        subtitle="Respalda esta tarea de la mantención."
        title="Foto de respaldo"
        onClear={foto.handleClearPhoto}
        onSelect={(file) => void foto.handleSelectPhoto(file)}
      />

      <div className="flex items-center justify-between gap-3">
        <Label>¿Qué se utilizó? (opcional)</Label>
        <Boton
          type="button"
          variante="contorno"
          onClick={() => setInsumos((filas) => [...filas, { insumoId: '', cantidad: '1' }])}
        >
          <Plus className="h-4 w-4" />
          Agregar insumo
        </Boton>
      </div>

      {insumos.length > 0 ? (
        <>
          {faenaBranch ? (
            <Automaticos>
              <Automatico label="Bodega" nota="Fija del taller" valor={faenaBranch.name} />
            </Automaticos>
          ) : (
            <div
              className="rounded-2xl bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-[var(--danger-soft-foreground)]"
              role="alert"
            >
              No hay una bodega de faena activa en Inventario — no se puede descontar stock.
            </div>
          )}

          {insumos.map((fila, index) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_6.5rem_52px] items-end gap-2.5 rounded-2xl border border-border bg-[#fafbfc] p-3"
              key={index}
            >
              <Campo label="Insumo">
                <SelectorBuscable
                  etiqueta="Insumo"
                  opciones={opcionesInsumo}
                  placeholder="Busca por código o nombre…"
                  tituloTabular
                  valor={fila.insumoId}
                  onChange={(valor) => editarFila(index, { insumoId: valor })}
                />
              </Campo>
              <Campo label="Cantidad">
                <Input
                  entero
                  value={fila.cantidad}
                  onChange={(e) => editarFila(index, { cantidad: e.target.value })}
                />
              </Campo>
              <Boton
                aria-label="Quitar insumo"
                className="h-[52px] w-[52px] px-0"
                type="button"
                variante="contorno"
                onClick={() => setInsumos((filas) => filas.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4.5 w-4.5" />
              </Boton>
            </div>
          ))}

          <div className="rounded-2xl bg-[var(--success-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--success-soft-foreground)]">
            Al guardar la tarea, estos insumos se <strong>descuentan automáticamente</strong> del
            stock de Faena y quedan como salida trazable ligada a la OT.
          </div>
        </>
      ) : null}

      <div className="flex gap-2.5">
        <Boton ancho type="button" variante="contorno" onClick={onListo}>
          Cancelar
        </Boton>
        <Boton
          ancho
          disabled={!lista || completar.isPending}
          type="button"
          variante="acento"
          onClick={() =>
            completar.mutate(
              {
                ordenId: orden.id,
                tareaId: tarea.id,
                notas: notas.trim(),
                foto: foto.file,
                ...(insumos.length > 0
                  ? {
                      insumos: insumos.map((fila) => ({
                        insumoId: fila.insumoId,
                        cantidad: Number(fila.cantidad),
                      })),
                      branchId: faenaBranch?.id,
                    }
                  : {}),
              },
              { onSuccess: onListo },
            )
          }
        >
          {completar.isPending ? (
            'Guardando…'
          ) : (
            <>
              <Check className="h-5 w-5" />
              Guardar tarea
            </>
          )}
        </Boton>
      </div>
    </div>
  );
}

/**
 * Tarjeta-checklist de la mantención preventiva (órdenes que nacen de la
 * pauta por horómetro/km). Cada tarea del hito se completa con ticket +
 * descripción + foto (+ los insumos usados, que descuentan stock) y se
 * guarda POR SEPARADO; el backend mueve la orden solo: con todas las tareas
 * pasa a "finalizada", y cada marca queda también en el ciclo del equipo.
 */
export function PreventiveChecklistModal({
  orden,
  equipment,
  soloLectura = false,
  etiqueta,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
  /** Finalizadas (o sin permiso): el checklist se consulta, no se marca. */
  soloLectura?: boolean;
  /** Texto del botón que abre el modal. */
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  // La tarea que se está completando — una a la vez, con su propia foto.
  const [tareaActiva, setTareaActiva] = useState<string | null>(null);

  const { hechas, total } = tareasHechas(orden);
  const tareas = useMemo(
    () => [...orden.tareas].sort((a, b) => a.posicion - b.posicion),
    [orden.tareas],
  );
  const hito =
    orden.pautaMilestone != null ? `Mantención de ${orden.pautaMilestone.toLocaleString('es-CL')}` : null;

  return (
    <>
      {soloLectura ? (
        <Boton variante="contorno" onClick={() => setAbierto(true)}>
          {etiqueta ?? 'Ver mantención'}
        </Boton>
      ) : (
        <Boton ancho variante="acento" onClick={() => setAbierto(true)}>
          <Wrench className="h-5 w-5" />
          {etiqueta ?? 'Registrar mantención'}
        </Boton>
      )}
      <ModalTerreno
        abierto={abierto}
        detalle="Completa cada tarea del hito con qué se hizo, su foto y los insumos usados. Se guardan de a una; con todas listas, la orden pasa sola a Finalizadas."
        titulo={hito ?? 'Mantención preventiva'}
        onAbiertoChange={(open) => {
          setAbierto(open);
          if (!open) setTareaActiva(null);
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-[15.5px] font-bold">
              {equipmentLabel(orden.equipoId, equipment)}
            </span>
            <Chip tono="info">Preventiva</Chip>
            <ChipEstado color={ESTADO_HEX[orden.estado] ?? '#92590a'}>
              {ESTADO_LABEL[orden.estado] ?? orden.estado}
            </ChipEstado>
            <Chip tono={hechas === total ? 'success' : 'neutral'}>
              {hechas} de {total} tareas
            </Chip>
          </div>

          <div className="flex flex-col gap-2.5">
            {tareas.map((tarea) =>
              tarea.hecha ? (
                <TareaHecha key={tarea.id} tarea={tarea} />
              ) : tareaActiva === tarea.id && !soloLectura ? (
                <TareaForm
                  key={tarea.id}
                  orden={orden}
                  tarea={tarea}
                  onListo={() => setTareaActiva(null)}
                />
              ) : (
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-3.5 py-3"
                  key={tarea.id}
                >
                  <span className="text-sm font-medium">{tarea.texto}</span>
                  {soloLectura ? (
                    <Chip tono="warning">Pendiente</Chip>
                  ) : (
                    <Boton
                      type="button"
                      variante="contorno"
                      onClick={() => setTareaActiva(tarea.id)}
                    >
                      Completar
                    </Boton>
                  )}
                </div>
              ),
            )}
          </div>

          {!soloLectura && hechas < total ? (
            <div className="rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--accent-soft-foreground)]">
              Cada tarea guardada queda también en el <strong>ciclo de mantenciones</strong> del
              equipo. Con la última, la orden se finaliza sola.
            </div>
          ) : null}

          <Boton type="button" variante="oscuro" onClick={() => setAbierto(false)}>
            Cerrar
          </Boton>
        </div>
      </ModalTerreno>
    </>
  );
}
