import { useState } from 'react';
import { Pencil } from 'lucide-react';

import { Boton, Campo, Input, ModalTerreno, Segmentado, Selector } from '../terreno/ui';
import { PRIORIDAD_OT_LABELS } from '../../config/mantenimiento-colors';
import { useActualizarOrden } from '../../hooks/useOrdenes';
import { useUsers } from '../../hooks/useUsers';
import { PRIORIDADES_OT, type OrdenTrabajo, type PrioridadOT } from '../../types/mantenimiento';
import { ROLES } from '../../types/roles';

const SIN_ASIGNAR = '__sin_asignar__';

type EstadoEditable = 'PENDIENTE' | 'EN_PROCESO';

/**
 * «Editar» de una operación pendiente o en proceso, para los casos
 * excepcionales (pedido del cliente, 17/11/2026): corregir el título, la
 * prioridad, el responsable o devolverla a pendiente. No cierra la
 * operación: eso sigue siendo «Registrar mantención» / «Finalizar tarea»,
 * que es lo que deja el registro.
 */
export function EditarOperacionModal({ orden }: { orden: OrdenTrabajo }) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(orden.titulo);
  const [prioridad, setPrioridad] = useState<PrioridadOT>(orden.prioridad);
  const [estado, setEstado] = useState<EstadoEditable>(orden.estado === 'EN_PROCESO' ? 'EN_PROCESO' : 'PENDIENTE');
  const [responsable, setResponsable] = useState(orden.asignadoA?.id ?? SIN_ASIGNAR);
  const { data: mantenedores } = useUsers({ role: ROLES.MANTENEDOR }, abierto);
  const actualizar = useActualizarOrden();

  const abrir = () => {
    // Siempre parte de lo que la tarjeta muestra hoy.
    setTitulo(orden.titulo);
    setPrioridad(orden.prioridad);
    setEstado(orden.estado === 'EN_PROCESO' ? 'EN_PROCESO' : 'PENDIENTE');
    setResponsable(orden.asignadoA?.id ?? SIN_ASIGNAR);
    setAbierto(true);
  };

  // El responsable actual aunque ya no sea mantenedor (p. ej. un admin que la tomó).
  const opciones = [
    { valor: SIN_ASIGNAR, titulo: 'Sin asignar' },
    ...(mantenedores ?? []).map((u) => ({ valor: u.id, titulo: u.name })),
    ...(orden.asignadoA && !(mantenedores ?? []).some((u) => u.id === orden.asignadoA?.id)
      ? [{ valor: orden.asignadoA.id, titulo: orden.asignadoA.nombre }]
      : []),
  ];
  const tituloLimpio = titulo.trim();

  const guardar = () => {
    if (!tituloLimpio) return;
    actualizar.mutate(
      {
        orden,
        input: {
          titulo: tituloLimpio,
          prioridad,
          ...(estado !== orden.estado ? { estado } : {}),
          asignadoAId: responsable === SIN_ASIGNAR ? null : responsable,
        },
      },
      { onSuccess: () => setAbierto(false) },
    );
  };

  return (
    <>
      <button
        aria-label="Editar"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground"
        onClick={abrir}
        title="Editar operación"
        type="button"
      >
        <Pencil aria-hidden className="size-4" />
      </button>
      <ModalTerreno abierto={abierto} detalle={orden.titulo} onAbiertoChange={setAbierto} titulo="Editar operación">
        <div className="flex flex-col gap-4 p-4">
          <Campo label="Título" error={tituloLimpio ? undefined : 'El título no puede quedar vacío.'}>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo label="Prioridad">
            <Segmentado
              etiqueta="Prioridad"
              onChange={setPrioridad}
              opciones={PRIORIDADES_OT.map((p) => ({ valor: p, label: PRIORIDAD_OT_LABELS[p] }))}
              valor={prioridad}
            />
          </Campo>
          <Campo label="Estado">
            <Segmentado
              etiqueta="Estado"
              onChange={setEstado}
              opciones={[
                { valor: 'PENDIENTE', label: 'Pendiente' },
                { valor: 'EN_PROCESO', label: 'En proceso' },
              ]}
              valor={estado}
            />
          </Campo>
          <Campo label="Responsable">
            <Selector etiqueta="Responsable" onChange={setResponsable} opciones={opciones} valor={responsable} />
          </Campo>
          <p className="m-0 text-[13px] text-muted-foreground">
            Para cerrarla usa «Registrar mantención» o «Finalizar tarea»: así queda el registro de lo que se hizo.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <Boton disabled={!tituloLimpio || actualizar.isPending} onClick={guardar} variante="acento">
              {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
            <Boton onClick={() => setAbierto(false)} variante="contorno">
              Cancelar
            </Boton>
          </div>
        </div>
      </ModalTerreno>
    </>
  );
}
