import { useMemo, useState } from 'react';
import { Check, CircleCheck, Wrench } from 'lucide-react';

import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import {
  Boton,
  Campo,
  Chip,
  ChipEstado,
  ModalTerreno,
  Textarea,
} from '../terreno/ui';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';
import { useCompletarTarea } from '../../hooks/useOrdenes';
import type { OrdenTrabajo, Tarea } from '../../types/mantenimiento';
import { equipmentLabel, type EquipmentRef } from './workshop';

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

/** Una tarea ya completada: solo lectura, con sus notas y su foto. */
function TareaHecha({ tarea }: { tarea: Tarea }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-[var(--success-soft)] px-3.5 py-3">
      <div className="flex items-start gap-2">
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success-soft-foreground)]" />
        <span className="text-sm font-semibold text-[var(--success-soft-foreground)]">
          {tarea.texto}
        </span>
      </div>
      {tarea.notas ? <p className="m-0 ps-6 text-[13px] leading-5">{tarea.notas}</p> : null}
      {tarea.fotoUrl ? (
        <a
          className="ps-6 text-[13px] font-semibold underline"
          href={tarea.fotoUrl}
          rel="noreferrer"
          target="_blank"
        >
          Ver foto de respaldo
        </a>
      ) : null}
    </div>
  );
}

/**
 * El formulario de UNA tarea del checklist: qué se hizo + foto de respaldo.
 * Los dos son obligatorios — el checklist preventivo deja evidencia, no solo
 * un ticket. Vive como componente propio para que el flujo de foto
 * (`usePhotoCaptureFlow`) nazca y muera con la tarea que se está completando.
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
  const [notas, setNotas] = useState('');
  const foto = usePhotoCaptureFlow(() => {}, { ocr: false });

  const lista = notas.trim().length > 0 && foto.file != null;

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
              { ordenId: orden.id, tareaId: tarea.id, notas: notas.trim(), foto: foto.file },
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
 * descripción + foto y se guarda POR SEPARADO; el backend mueve la orden
 * solo: con la primera tarea pasa a "en proceso" y con todas a "finalizada",
 * y cada marca queda también en el ciclo de mantenciones del equipo.
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
        detalle="Completa cada tarea del hito con qué se hizo y su foto. Se guardan de a una; con todas listas, la orden pasa sola a Finalizadas."
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
