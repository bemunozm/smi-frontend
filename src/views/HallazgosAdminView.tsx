import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Table,
  TextArea,
  TextField,
} from '@heroui/react';

import { useEquipment } from '../hooks/useEquipment';
import { useActualizarHallazgo, useCrearHallazgo, useEliminarHallazgo, useHallazgosList } from '../hooks/useHallazgos';
import {
  criticidadChipColor,
  hallazgoEstadoChipColor,
  hallazgoEstadoLabel,
} from '../config/dashboard-colors';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { PRIORIDADES } from '../types/hallazgos';
import type { EditHallazgoBody, Hallazgo } from '../types/hallazgos';
import type { Criticidad, HallazgoEstado } from '../types/dashboard';

const ESTADOS = ['ABIERTO', 'EN_PROCESO', 'CERRADO'] as const;

const PRIORIDAD_LABEL: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Solo el día, para la fila «Fecha» del detalle (la hora va en su propia fila). */
function formatSoloFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatHora(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Fila etiqueta/valor del detalle — mismo patrón que el popup de trabajos extra. */
function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/** Chips de prioridad/estado — mismos mapeos del dashboard; el dominio de
 * Terreno tipa estos campos como `string`, se castean acá igual que en
 * `config/dashboard-aggregations.ts`. */
function ChipsHallazgo({ hallazgo }: { hallazgo: Hallazgo }) {
  return (
    <>
      <Chip color={criticidadChipColor(hallazgo.prioridad as Criticidad)} size="sm" variant="soft">
        {PRIORIDAD_LABEL[hallazgo.prioridad] ?? hallazgo.prioridad}
      </Chip>
      <Chip color={hallazgoEstadoChipColor(hallazgo.estado as HallazgoEstado)} size="sm" variant="secondary">
        {hallazgoEstadoLabel(hallazgo.estado as HallazgoEstado)}
      </Chip>
    </>
  );
}

/** Popup de detalle: la info completa del hallazgo (foto incluida) con las
 * acciones del administrador al pie — editar o eliminar. */
function DetalleHallazgoModal({
  hallazgo,
  onClose,
  onEditar,
  onEliminar,
}: {
  hallazgo: Hallazgo | null;
  onClose: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <Modal.Backdrop
      isDismissable
      isOpen={hallazgo !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {`Hallazgo · ${hallazgo?.equipo?.internalCode ?? '—'}`}
            </Modal.Heading>
            {hallazgo ? (
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                <ChipsHallazgo hallazgo={hallazgo} />
              </div>
            ) : null}
          </Modal.Header>
          <Modal.Body>
            {hallazgo ? (
              <div className="flex flex-col gap-4">
                {/* Mismo patrón de filas de dato que el detalle de trabajos extra:
                   fecha y hora separadas (lo que se lee primero al revisar un
                   reporte) y quién lo registró, para pedir contexto directo. */}
                <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
                  <Dato label="Fecha" value={formatSoloFecha(hallazgo.fecha)} />
                  <Dato label="Hora" value={formatHora(hallazgo.fecha)} />
                  <Dato label="Equipo" value={hallazgo.equipo?.internalCode ?? '—'} />
                  <Dato label="Registrado por" value={hallazgo.registradoPor ?? '—'} />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
                    Descripción
                  </span>
                  <p className="text-sm text-foreground">{hallazgo.descripcion}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">Foto</span>
                  {hallazgo.fotoUrl ? (
                    <a
                      className="group relative block overflow-hidden rounded-2xl border border-border"
                      href={hallazgo.fotoUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <img
                        alt={`Foto del hallazgo de ${hallazgo.equipo?.internalCode ?? 'equipo'}`}
                        className="max-h-80 w-full bg-surface-secondary object-contain"
                        src={hallazgo.fotoUrl}
                      />
                      <span className="absolute right-2 bottom-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Abrir en tamaño completo
                      </span>
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin foto adjunta.</p>
                  )}
                </div>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onEliminar} variant="danger">
              Eliminar
            </Button>
            <Button onPress={onEditar}>Editar</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * Alta directa del administrador: equipo, prioridad y descripción — la foto no
 * va acá (se adjunta desde Terreno, donde se saca). El POST es online, con id
 * idempotente del cliente (`useCrearHallazgo`); el hallazgo nace ABIERTO y
 * dispara el mismo aviso al taller que uno reportado en terreno.
 */
function CrearHallazgoModal({ onClose }: { onClose: () => void }) {
  const { data: equipos } = useEquipment();
  const crear = useCrearHallazgo();
  const [equipoId, setEquipoId] = useState('');
  const [prioridad, setPrioridad] = useState<string>('MEDIA');
  const [descripcion, setDescripcion] = useState('');

  const valido = equipoId.length > 0 && descripcion.trim().length >= 3;

  const registrar = () => {
    crear.mutate(
      { equipoId, descripcion: descripcion.trim(), prioridad: prioridad as (typeof PRIORIDADES)[number] },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Nuevo hallazgo
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select fullWidth placeholder="Elegir equipo" value={equipoId} onChange={(value) => value && setEquipoId(String(value))}>
                  <Label>Equipo</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {(equipos ?? []).map((equipo) => (
                        <ListBox.Item id={equipo.id} key={equipo.id} textValue={equipo.internalCode}>
                          {equipo.internalCode}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select fullWidth value={prioridad} onChange={(value) => value && setPrioridad(String(value))}>
                  <Label>Prioridad</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {PRIORIDADES.map((opcion) => (
                        <ListBox.Item id={opcion} key={opcion} textValue={PRIORIDAD_LABEL[opcion]}>
                          {PRIORIDAD_LABEL[opcion]}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <TextField fullWidth name="descripcion" onChange={setDescripcion} value={descripcion}>
                <Label>Descripción</Label>
                <TextArea placeholder="Qué se encontró y dónde…" rows={3} />
              </TextField>

              <p className="text-xs text-muted-foreground">
                La foto del hallazgo se adjunta desde Terreno, al momento de reportarlo en la máquina.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              Cancelar
            </Button>
            <Button isDisabled={!valido} isPending={crear.isPending} onPress={registrar}>
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar hallazgo')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * Edición directa del administrador: 4 campos (equipo, descripción, prioridad,
 * estado) con estado local — se monta por hallazgo (el padre lo renderiza solo
 * cuando hay uno en edición), así los valores iniciales salen del registro.
 * Solo viajan los campos que cambiaron; el backend registra el diff en el
 * historial y avisa, igual que las correcciones de Terreno.
 */
function EditarHallazgoModal({ hallazgo, onClose }: { hallazgo: Hallazgo; onClose: () => void }) {
  const { data: equipos } = useEquipment();
  const actualizar = useActualizarHallazgo();
  const [equipoId, setEquipoId] = useState(hallazgo.equipoId);
  const [descripcion, setDescripcion] = useState(hallazgo.descripcion);
  const [prioridad, setPrioridad] = useState(hallazgo.prioridad);
  const [estado, setEstado] = useState(hallazgo.estado);

  const cambios: EditHallazgoBody = {
    ...(equipoId !== hallazgo.equipoId ? { equipoId } : {}),
    ...(descripcion.trim() !== hallazgo.descripcion ? { descripcion: descripcion.trim() } : {}),
    ...(prioridad !== hallazgo.prioridad ? { prioridad } : {}),
    ...(estado !== hallazgo.estado ? { estado } : {}),
  };
  const hayCambios = Object.keys(cambios).length > 0;
  const descripcionValida = descripcion.trim().length >= 3;

  const guardar = () => {
    actualizar.mutate({ id: hallazgo.id, cambios }, { onSuccess: onClose });
  };

  return (
    <Modal.Backdrop
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {`Editar hallazgo · ${hallazgo.equipo?.internalCode ?? '—'}`}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Select fullWidth value={equipoId} onChange={(value) => value && setEquipoId(String(value))}>
                  <Label>Equipo</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {(equipos ?? []).map((equipo) => (
                        <ListBox.Item id={equipo.id} key={equipo.id} textValue={equipo.internalCode}>
                          {equipo.internalCode}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select fullWidth value={prioridad} onChange={(value) => value && setPrioridad(String(value))}>
                  <Label>Prioridad</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {PRIORIDADES.map((opcion) => (
                        <ListBox.Item id={opcion} key={opcion} textValue={PRIORIDAD_LABEL[opcion]}>
                          {PRIORIDAD_LABEL[opcion]}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select fullWidth value={estado} onChange={(value) => value && setEstado(String(value))}>
                  <Label>Estado</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {ESTADOS.map((opcion) => (
                        <ListBox.Item id={opcion} key={opcion} textValue={hallazgoEstadoLabel(opcion)}>
                          {hallazgoEstadoLabel(opcion)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <TextField
                fullWidth
                isInvalid={!descripcionValida}
                name="descripcion"
                onChange={setDescripcion}
                value={descripcion}
              >
                <Label>Descripción</Label>
                <TextArea rows={3} />
              </TextField>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              Cancelar
            </Button>
            <Button isDisabled={!hayCambios || !descripcionValida} isPending={actualizar.isPending} onPress={guardar}>
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar cambios')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * Vista de hallazgos del ADMINISTRADOR (`/hallazgos`, ruta solo ADMIN):
 * todos los hallazgos de Terreno en una tabla de escritorio, con detalle en
 * popup y las dos acciones que Terreno no tiene — editar directo (PATCH) y
 * eliminar (DELETE, endpoint solo ADMIN). Es el destino de «Ver todo» de los
 * popups de hallazgos del dashboard.
 */
export function HallazgosAdminView() {
  const { data: hallazgos, isPending, isError, error } = useHallazgosList();
  const eliminar = useEliminarHallazgo();
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS');
  const [editando, setEditando] = useState<Hallazgo | null>(null);
  const [eliminando, setEliminando] = useState<Hallazgo | null>(null);
  const [creando, setCreando] = useState(false);

  const lista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (hallazgos ?? []).filter((h) => {
      if (estadoFiltro !== 'TODOS' && h.estado !== estadoFiltro) return false;
      if (!texto) return true;
      return (
        h.descripcion.toLowerCase().includes(texto) ||
        (h.equipo?.internalCode ?? '').toLowerCase().includes(texto)
      );
    });
  }, [hallazgos, busqueda, estadoFiltro]);

  const porId = useMemo(() => new Map((hallazgos ?? []).map((h) => [h.id, h])), [hallazgos]);
  const cuenta = (estado: string) => (hallazgos ?? []).filter((h) => h.estado === estado).length;

  // El detalle vive en `?id=`: la notificación «hallazgo creado» del admin
  // llega acá con el id y el popup se abre solo (mismo patrón que /mantenciones).
  const detalleId = params.get('id');
  const detalle = detalleId ? (porId.get(detalleId) ?? null) : null;
  const abrirDetalle = (id: string) => {
    const siguientes = new URLSearchParams(params);
    siguientes.set('id', id);
    setParams(siguientes, { replace: true });
  };
  const cerrarDetalle = () => {
    const siguientes = new URLSearchParams(params);
    siguientes.delete('id');
    setParams(siguientes, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Hallazgos
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">Hallazgos</h1>
          <p className="text-sm text-muted-foreground">
            Todos los reportes de terreno. Abre uno para ver su detalle, corregirlo o eliminarlo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ESTADOS.map((estado) => (
            <Chip color={hallazgoEstadoChipColor(estado)} data-testid={`total-${estado}`} key={estado} size="md" variant="soft">
              {cuenta(estado).toLocaleString('es-CL')} {hallazgoEstadoLabel(estado).toLowerCase()}
            </Chip>
          ))}
          <Button onPress={() => setCreando(true)}>Nuevo hallazgo</Button>
        </div>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Card.Title>Listado</Card.Title>
              <Card.Description>Del más reciente al más antiguo.</Card.Description>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TextField aria-label="Buscar" name="busqueda" onChange={setBusqueda} value={busqueda}>
                <Input placeholder="Buscar por equipo o descripción…" />
              </TextField>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Estado
                <select
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  onChange={(event) => setEstadoFiltro(event.target.value)}
                  value={estadoFiltro}
                >
                  <option value="TODOS">Todos</option>
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {hallazgoEstadoLabel(estado)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}

          {isError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {error instanceof Error ? error.message : 'No se pudo cargar los hallazgos.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {(hallazgos ?? []).length === 0 ? 'No hay hallazgos registrados.' : 'Ningún hallazgo calza con el filtro.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length > 0 ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Hallazgos" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Equipo</Table.Column>
                    <Table.Column className="w-full">Descripción</Table.Column>
                    <Table.Column>Prioridad</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column>Registrado por</Table.Column>
                    <Table.Column>Foto</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {lista.map((h) => (
                      <Table.Row
                        className="cursor-pointer"
                        data-testid={`hallazgo-fila-${h.id}`}
                        key={h.id}
                        onAction={() => abrirDetalle(h.id)}
                      >
                        {/* `whitespace-nowrap` en las columnas cortas: sin él, la columna
                           ancha (Descripción, `w-full`) las aprieta y la fecha y los
                           chips se parten en varias líneas. */}
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatFecha(h.fecha)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm whitespace-nowrap">
                          {h.equipo?.internalCode ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="max-w-0 truncate text-sm">{h.descripcion}</Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <Chip color={criticidadChipColor(h.prioridad as Criticidad)} size="sm" variant="soft">
                            {PRIORIDAD_LABEL[h.prioridad] ?? h.prioridad}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <Chip color={hallazgoEstadoChipColor(h.estado as HallazgoEstado)} size="sm" variant="secondary">
                            {hallazgoEstadoLabel(h.estado as HallazgoEstado)}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{h.registradoPor ?? '—'}</Table.Cell>
                        <Table.Cell className="text-sm text-muted-foreground">{h.fotoUrl ? 'Sí' : '—'}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <DetalleHallazgoModal
        hallazgo={detalle}
        onClose={cerrarDetalle}
        onEditar={() => {
          if (detalle) setEditando(detalle);
          cerrarDetalle();
        }}
        onEliminar={() => {
          if (detalle) setEliminando(detalle);
          cerrarDetalle();
        }}
      />

      {editando ? <EditarHallazgoModal hallazgo={editando} onClose={() => setEditando(null)} /> : null}

      {creando ? <CrearHallazgoModal onClose={() => setCreando(false)} /> : null}

      <AlertDialog.Backdrop
        isOpen={eliminando !== null}
        onOpenChange={(open) => {
          if (!open) setEliminando(null);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-105">
            {({ close }) => (
              <>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>¿Eliminar hallazgo?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    El hallazgo de {eliminando?.equipo?.internalCode ?? 'este equipo'} (
                    {eliminando ? `«${eliminando.descripcion}»` : ''}) se eliminará definitivamente, junto a su foto.
                    Esta acción no se puede deshacer.
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button onPress={close} variant="tertiary">
                    Cancelar
                  </Button>
                  <Button
                    isPending={eliminar.isPending}
                    onPress={() => {
                      if (!eliminando) return;
                      eliminar.mutate(eliminando.id, {
                        onSuccess: () => {
                          close();
                          setEliminando(null);
                        },
                      });
                    }}
                    variant="danger"
                  >
                    {eliminar.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
