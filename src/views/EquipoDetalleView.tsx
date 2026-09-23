import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  Clock,
  Droplet,
  Pencil,
  Plus,
  Trash2,
  User,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { AlertDialog, Button, Card, Dropdown, Label, ListBox, Select, Spinner, Table } from '@heroui/react';

import { assetUrl } from '../api/UploadsAPI';
import { useAssignEquipment, useEquipmentDetail, useUpdateEquipmentStatus } from '../hooks/useEquipment';
import { useHorometroList } from '../hooks/useHorometro';
import { useCombustibleList } from '../hooks/useCombustible';
import { useDeleteEquipmentDocument, useEquipmentDocuments } from '../hooks/useEquipmentDocuments';
import { useFicha } from '../hooks/useFicha';
import { useUsers } from '../hooks/useUsers';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  controlUnitLabel,
  controlUnitSuffix,
  documentExpiryCaption,
  documentStatusChipColor,
  documentStatusLabel,
  equipmentClassLabel,
  equipmentDocumentTypeLabel,
  equipmentStatusChipColor,
  equipmentStatusLabel,
  equipoEstadoUsoLabel,
  equipoIdentidad,
  FUEL_TONE_CLASSES,
  fuelTone,
  turnoLabel,
} from '../config/flota-colors';
import { eventoTipoColor, eventoTipoIcon, eventoTipoLabel } from '../config/ficha-colors';
import { ROLES } from '../types/roles';
import { EQUIPMENT_STATUS, type EquipmentDetail, type EquipmentStatus } from '../types/equipment';
import type { EquipmentDocument } from '../types/equipment-document';
import { EquipoThumb } from '../components/flota/EquipoThumb';
import { StatusChip } from '../components/flota/StatusChip';
import { EditEquipoModal, DeleteEquipoAlertDialog, idDesdeSentinel, SIN_ASIGNAR } from '../components/flota/EquipoEditDelete';
import { EquipmentDocumentModal } from '../components/flota/EquipmentDocumentModal';
import { registrarHorometroLabel, RegistrarHorometroModal } from '../components/flota/RegistrarHorometroModal';
import { RegistrarCargaCombustibleModal } from '../components/flota/RegistrarCargaCombustibleModal';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

const TIPO_COMBUSTIBLE_LABEL: Record<string, string> = {
  PETROLEO: 'Petróleo',
  BENCINA: 'Bencina',
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

/** Versión corta (sin hora) — para captions de KPI, donde el espacio es
 * angosto y la hora no aporta (calca `k.caption` de `FichaEquipoClientePC.dc.html`). */
function formatFechaCorta(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(date);
}

/** Duración real de un turno cerrado (`fechaSalida − fecha`), en formato
 * corto "Xh Ym" — complementa el uso en horas-máquina (`valorFinal −
 * valorInicial`) de la tabla de historial de horómetro: son dos medidas
 * distintas (tiempo de reloj vs. horas de motor) que pueden diferir bastante
 * (un turno de 8h de reloj con el motor detenido gran parte del tiempo). */
function formatDuracion(fechaInicioIso: string, fechaFinIso: string): string {
  const inicio = new Date(fechaInicioIso).getTime();
  const fin = new Date(fechaFinIso).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin) || fin < inicio) return '—';
  const totalMinutos = Math.round((fin - inicio) / 60000);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return `${minutos} min`;
  return minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`;
}

/** Fila "Datos de la unidad" — calca `.datarow` (label uppercase a la
 * izquierda, valor alineado a la derecha, siempre en fila, incluso en
 * celular: el artefacto NUNCA apila label/valor). */
function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

const DEFAULT_KPI_TONE = 'bg-accent-soft text-accent-soft-foreground';

interface KpiTileProps {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
  hero?: boolean;
  toneClass?: string;
}

/** Tarjeta de la fila de KPIs — calca `.kpi`/`.kpi-hero` de
 * `FichaEquipoClientePC.dc.html` (icono con badge de color, label, valor
 * grande en mono y una caption). La primera (uso acumulado) es la única
 * "hero" — borde de acento y valor más grande, igual que el artefacto. */
function KpiTile({ icon, label, value, caption, hero, toneClass }: KpiTileProps) {
  return (
    <Card className={hero ? 'border-(--accent)' : undefined}>
      <Card.Content className="flex flex-col gap-2.5 p-4">
        <span
          className={`flex h-8.5 w-8.5 items-center justify-center rounded-[9px] ${toneClass ?? DEFAULT_KPI_TONE}`}
        >
          {icon}
        </span>
        <span className="text-[10.5px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
        <span
          className={`font-mono font-bold tracking-[-0.01em] text-foreground ${hero ? 'text-[26px]' : 'text-[20px]'}`}
        >
          {value}
        </span>
        <span className="text-[11.5px] leading-snug text-(--muted)">{caption}</span>
      </Card.Content>
    </Card>
  );
}

/**
 * Pickers de operador/supervisor + "Guardar asignación"/"Liberar" — la
 * acción de asignar/liberar que pide la Fase 2 (§2). Solo se monta para
 * quien puede escribir la asignación (ver `puedeAsignar` en la vista); el
 * backend gatilla `PATCH /equipment/:id/assignment` a ADMIN/SUPERVISOR,
 * mismo criterio que `updateStatus` en `EquiposView`.
 */
function AsignacionForm({ equipo }: { equipo: EquipmentDetail }) {
  const assignEquipment = useAssignEquipment();
  const { data: operadores } = useUsers({ role: ROLES.OPERADOR });
  const { data: supervisores } = useUsers({ role: ROLES.SUPERVISOR });
  const [operatorId, setOperatorId] = useState(equipo.operator?.id ?? SIN_ASIGNAR);
  const [supervisorId, setSupervisorId] = useState(equipo.supervisor?.id ?? SIN_ASIGNAR);

  // La ficha se refresca sola cuando la asignación cambia (invalidación de
  // `useAssignEquipment`) — re-sincroniza los pickers con la asignación real
  // en cada refetch, mismo criterio que `EditEquipoModal` en `EquiposView`.
  useEffect(() => {
    setOperatorId(equipo.operator?.id ?? SIN_ASIGNAR);
    setSupervisorId(equipo.supervisor?.id ?? SIN_ASIGNAR);
  }, [equipo.operator?.id, equipo.supervisor?.id]);

  const operatorIdFinal = idDesdeSentinel(operatorId);
  const supervisorIdFinal = idDesdeSentinel(supervisorId);
  const huboCambio =
    operatorIdFinal !== (equipo.operator?.id ?? null) || supervisorIdFinal !== (equipo.supervisor?.id ?? null);

  const guardar = () => {
    assignEquipment.mutate({
      id: equipo.id,
      input: { operatorId: operatorIdFinal, supervisorId: supervisorIdFinal },
    });
  };

  const liberar = () => {
    // No se limpia el estado local de forma optimista: el `onError` de
    // `useAssignEquipment` solo toastea (no invalida), así que si la
    // mutación fallaba los pickers quedaban mostrando "Sin asignar" mientras
    // el server mantenía la asignación (Fix 3, review QA) — el `useEffect`
    // de arriba está keyed en `equipo.operator?.id`/`supervisor?.id`, y esos
    // props no cambian si la request falla. Al tener éxito, `onSuccess`
    // invalida la ficha y ese mismo efecto resincroniza los pickers con la
    // asignación real (ya vacía).
    assignEquipment.mutate({ id: equipo.id, input: { operatorId: null, supervisorId: null } });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-separator pt-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Select fullWidth value={operatorId} onChange={(value) => value && setOperatorId(String(value))}>
          <Label>Operador</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={SIN_ASIGNAR} textValue="Sin operador asignado">
                Sin operador asignado
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {(operadores ?? []).map((operador) => (
                <ListBox.Item key={operador.id} id={operador.id} textValue={operador.name}>
                  {operador.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select fullWidth value={supervisorId} onChange={(value) => value && setSupervisorId(String(value))}>
          <Label>Supervisor a cargo</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={SIN_ASIGNAR} textValue="Sin supervisor asignado">
                Sin supervisor asignado
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {(supervisores ?? []).map((supervisor) => (
                <ListBox.Item key={supervisor.id} id={supervisor.id} textValue={supervisor.name}>
                  {supervisor.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="flex shrink-0 gap-2">
        {/* `equipo.operator || equipo.supervisor` (no `equipo.inUse`, que el
           backend deriva de `!!operator`): si solo hay supervisor asignado
           (sin operador) igual hay que poder liberarlo (Fix 4, review QA). */}
        {equipo.operator || equipo.supervisor ? (
          <Button isDisabled={assignEquipment.isPending} onPress={liberar} size="sm" variant="secondary">
            Liberar
          </Button>
        ) : null}
        <Button isDisabled={!huboCambio} isPending={assignEquipment.isPending} onPress={guardar} size="sm">
          {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar asignación')}
        </Button>
      </div>
    </div>
  );
}

/** Fila de UN documento del equipo dentro de `DocumentsCard` — tipo + título a
 * la izquierda (con chip de vigencia y caption), link "Ver / descargar" si
 * tiene archivo adjunto, acciones editar/borrar a la derecha (gateadas a
 * SUPERVISOR/ADMIN, mismo criterio que crear). Reemplaza a `DocumentoRow`
 * (R1/R2 fijos) — ahora la unidad puede tener cualquier cantidad de
 * documentos, de cualquiera de los 5 tipos (`EquipmentDocumentType`). */
function DocumentoItemRow({
  documento,
  puedeGestionar,
  onEdit,
  onDelete,
}: {
  documento: EquipmentDocument;
  puedeGestionar: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const href = assetUrl(documento.fileUrl);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-t border-separator py-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
            {equipmentDocumentTypeLabel(documento.type)}
          </span>
          <StatusChip tone={documentStatusChipColor(documento.status)}>
            {documentStatusLabel(documento.status)}
          </StatusChip>
        </div>
        {documento.title ? <span className="text-sm font-semibold text-foreground">{documento.title}</span> : null}
        <span className="text-xs text-(--muted)">
          {documento.expiryDate ? formatFechaCorta(documento.expiryDate) : 'Sin vencimiento'}
          {documento.daysToExpiry != null ? ` · ${documentExpiryCaption(documento)}` : ''}
        </span>
        {href ? (
          <a
            className="w-fit text-xs font-semibold text-(--accent) hover:underline"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            Ver / descargar
          </a>
        ) : null}
      </div>

      {puedeGestionar ? (
        <div className="flex shrink-0 gap-1.5">
          <Button aria-label="Editar documento" isIconOnly onPress={onEdit} size="sm" variant="secondary">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button aria-label="Eliminar documento" isIconOnly onPress={onDelete} size="sm" variant="danger">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Documentos" — lista libre de documentos del equipo (revisión técnica,
 * seguro, permiso de circulación, certificaciones, otros), cerca de "Datos de
 * la unidad" (misma jerarquía de `Card`, sin anidar otra card adentro).
 * Reemplaza a `VencimientosCard` (R1/R2 fijos, solo lectura): ahora
 * SUPERVISOR/ADMIN pueden agregar/editar/borrar documentos directamente desde
 * acá — ya no se editan desde "Editar equipo" (ver `EquipoEditDelete.tsx`,
 * que perdió esos 2 campos).
 */
function DocumentsCard({ equipoId, puedeGestionar }: { equipoId: string; puedeGestionar: boolean }) {
  const { data: documentos, isPending, isError } = useEquipmentDocuments(equipoId);
  const deleteDocument = useDeleteEquipmentDocument(equipoId);
  const [modalDoc, setModalDoc] = useState<EquipmentDocument | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<EquipmentDocument | null>(null);

  const abrirCrear = () => {
    setModalDoc(null);
    setIsModalOpen(true);
  };
  const abrirEditar = (documento: EquipmentDocument) => {
    setModalDoc(documento);
    setIsModalOpen(true);
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Card.Title>Documentos</Card.Title>
            <Card.Description>Revisión técnica, seguro, permisos y otros documentos de la unidad.</Card.Description>
          </div>
          {puedeGestionar ? (
            <Button onPress={abrirCrear} size="sm" variant="secondary">
              <Plus className="h-3.5 w-3.5" />
              Agregar documento
            </Button>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="mt-1">
        {isPending ? (
          <div className="flex justify-center py-6">
            <Spinner color="accent" size="sm" />
          </div>
        ) : null}

        {isError ? <p className="text-sm text-(--muted)">No se pudieron cargar los documentos.</p> : null}

        {!isPending && !isError && (documentos ?? []).length === 0 ? (
          <p className="text-sm text-(--muted)">Esta unidad todavía no tiene documentos registrados.</p>
        ) : null}

        {!isPending && !isError
          ? (documentos ?? []).map((documento) => (
              <DocumentoItemRow
                documento={documento}
                key={documento.id}
                onDelete={() => setDeletingDoc(documento)}
                onEdit={() => abrirEditar(documento)}
                puedeGestionar={puedeGestionar}
              />
            ))
          : null}
      </Card.Content>

      <EquipmentDocumentModal
        document={modalDoc}
        equipmentId={equipoId}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
      />

      <AlertDialog.Backdrop
        isOpen={!!deletingDoc}
        onOpenChange={(open) => {
          if (!open) setDeletingDoc(null);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-105">
            {({ close }) => (
              <>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>¿Eliminar documento?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    {deletingDoc ? equipmentDocumentTypeLabel(deletingDoc.type) : ''}
                    {deletingDoc?.title ? ` · ${deletingDoc.title}` : ''} se eliminará de esta unidad. Esta acción no
                    se puede deshacer.
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button variant="tertiary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    isPending={deleteDocument.isPending}
                    variant="danger"
                    onPress={() => {
                      if (!deletingDoc) return;
                      deleteDocument.mutate(deletingDoc.id, {
                        onSuccess: () => {
                          close();
                          setDeletingDoc(null);
                        },
                      });
                    }}
                  >
                    {deleteDocument.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </Card>
  );
}

/** "Estado de uso" — calca el bloque "En uso por / Operador / Supervisor a
 * cargo" de `FichaEquipoClientePC/Tablet/Phone.dc.html`. Muestra el estado
 * (lectura) y, si el usuario puede escribir la asignación, los pickers para
 * asignar/liberar debajo. */
function EstadoDeUso({ equipo, puedeAsignar }: { equipo: EquipmentDetail; puedeAsignar: boolean }) {
  // Antes esto se decidía leyendo `equipo.inUse` (que el backend deriva de
  // `!!operator`): un equipo con supervisor asignado pero SIN operador
  // mostraba "Disponible" y el supervisor desaparecía de la ficha, aunque el
  // picker de editar lo mostraba preseleccionado (Fix 4, review QA). Ahora
  // se decide por presencia real de cualquiera de los dos, y el título
  // distingue "En uso" (hay operador) de "Supervisado" (solo supervisor).
  const tieneAsignacion = Boolean(equipo.operator || equipo.supervisor);
  // Fuente única con `AsignacionCell` de `EquiposView` — ver
  // `equipoEstadoUsoLabel` (`flota-colors.ts`): antes, sin asignación, acá
  // se mostraba siempre "Disponible" IGNORANDO `equipo.status`, mientras el
  // listado ya distinguía "Disponible"/"Detenido" — mismo equipo, dos
  // textos contradictorios (Fix F-ALTA, review adversarial).
  const estadoLabel = equipoEstadoUsoLabel(equipo);

  return (
    <Card>
      <Card.Content className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
                tieneAsignacion ? 'bg-success-soft text-success-soft-foreground' : 'bg-surface-tertiary text-(--muted)'
              }`}
            >
              <Users className="h-4.75 w-4.75" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">Estado de uso</p>
              {/* Título en accent (azul), no verde — a diferencia del chip
                 "En uso" del LISTADO (`AsignacionCell`, sí verde a propósito):
                 acá calca `usoTitleColor` de `FichaEquipoClientePC.dc.html`. */}
              <span className={`text-[15px] font-bold ${tieneAsignacion ? 'text-(--accent)' : 'text-(--muted)'}`}>
                {estadoLabel}
              </span>
            </div>
          </div>

          {tieneAsignacion ? (
            <div className="flex flex-wrap items-center gap-6">
              {equipo.operator ? (
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-(--muted)">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold tracking-wider text-(--label-color) uppercase">
                      Operador
                    </span>
                    <span className="text-sm font-semibold text-foreground">{equipo.operator.name}</span>
                  </div>
                </div>
              ) : null}
              {equipo.supervisor ? (
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-(--muted)">
                    <UserCheck className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold tracking-wider text-(--label-color) uppercase">
                      Supervisor a cargo
                    </span>
                    <span className="text-sm font-semibold text-foreground">{equipo.supervisor.name}</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <StatusChip tone="default">{estadoLabel}</StatusChip>
          )}
        </div>

        {puedeAsignar ? <AsignacionForm equipo={equipo} /> : null}
      </Card.Content>
    </Card>
  );
}

/**
 * Repuestos compatibles es dominio Compatibilidad (Joaquín, `PartCompatibility`
 * en `smi-backend/prisma/schema.prisma`): el modelo ya existe en la BD, pero
 * todavía no hay service/controller que lo exponga (`GET /api/equipment/:id`
 * no trae repuestos). Se deja la sección en su lugar del layout con un
 * estado vacío — cablear la tabla (SKU/nombre/N.° parte/existencia por
 * sucursal, ver el modelo) es follow-up coordinado con Compatibilidad, no
 * algo que este cambio deba inventar del lado del backend.
 */
function RepuestosCompatiblesCard() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Repuestos compatibles</Card.Title>
        <Card.Description>Existencia de cada repuesto, por sucursal.</Card.Description>
      </Card.Header>
      <Card.Content className="mt-1">
        <p className="text-sm text-(--muted)">
          Todavía no hay una API de Compatibilidad para listar los repuestos de esta unidad — follow-up
          coordinado con ese dominio.
        </p>
      </Card.Content>
    </Card>
  );
}

/**
 * "Actividad reciente" — calca el timeline de `FichaEquipoClientePC/Tablet/
 * Phone.dc.html`, pero reusando la bitácora consolidada REAL de Núcleo
 * (`useFicha`, la misma fuente de `FichaEquipoView` en `/equipos/:id/ficha`)
 * en vez de inventar un feed propio: esta ficha (Flota) no cruza dominios,
 * así que solo muestra un adelanto (últimos 6 eventos) con link a la
 * bitácora completa. Sección no crítica — si falla, no rompe el resto de
 * la ficha.
 */
function ActividadReciente({ equipoId }: { equipoId: string }) {
  const { data: ficha, isPending, isError } = useFicha(equipoId);
  const eventos = (ficha?.timeline ?? []).slice(0, 6);

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Card.Title>Actividad reciente</Card.Title>
            <Card.Description>Últimos eventos registrados para esta unidad.</Card.Description>
          </div>
          <Link className="shrink-0 text-xs font-semibold text-(--accent) hover:underline" to={`/equipos/${equipoId}/ficha`}>
            Ver bitácora completa →
          </Link>
        </div>
      </Card.Header>
      <Card.Content className="mt-1">
        {isPending ? (
          <div className="flex justify-center py-6">
            <Spinner color="accent" size="sm" />
          </div>
        ) : null}

        {isError ? (
          <p className="text-sm text-(--muted)">No se pudo cargar la actividad reciente.</p>
        ) : null}

        {!isPending && !isError && eventos.length === 0 ? (
          <p className="text-sm text-(--muted)">Esta unidad todavía no tiene actividad registrada.</p>
        ) : null}

        {!isPending && !isError && eventos.length > 0 ? (
          <ul className="flex flex-col">
            {eventos.map((evento, index) => {
              const Icono = eventoTipoIcon(evento.tipo);
              return (
                <li className="flex gap-3" key={evento.id}>
                  <div className="flex w-7 shrink-0 flex-col items-center">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TIMELINE_DOT_CLASSES[eventoTipoColor(evento)]}`}
                    >
                      <Icono className="h-3.5 w-3.5" />
                    </span>
                    {index < eventos.length - 1 ? <span className="mt-1 min-h-3.5 w-px flex-1 bg-separator" /> : null}
                  </div>
                  <div className={`min-w-0 flex-1 pt-1 ${index < eventos.length - 1 ? 'pb-4' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-foreground">{evento.titulo}</span>
                      <StatusChip tone={eventoTipoColor(evento)}>{eventoTipoLabel(evento.tipo)}</StatusChip>
                    </div>
                    <p className="mt-0.5 text-[13px] text-(--muted)">{evento.detalle}</p>
                    <span className="font-mono text-[11.5px] text-(--muted)">{formatFecha(evento.fecha)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/** Fondo/ícono del dot del timeline — mismo tono "soft" que el chip de tipo
 * de al lado (`eventoTipoColor`), calca `dotBg`/`dotFg` de
 * `FichaEquipoClientePC.dc.html` (siempre el par soft del mismo tono, nunca
 * un color sólido aparte). */
const TIMELINE_DOT_CLASSES: Record<'accent' | 'success' | 'warning' | 'danger' | 'default', string> = {
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground',
  default: 'bg-surface-tertiary text-(--muted)',
};

/**
 * Banner "Turno en curso" — visibilidad explícita de que hay un turno de
 * horómetro ABIERTO (ENTRADA sin SALIDA todavía), pedida por el flujo de
 * dos pasos: quien mira la ficha tiene que poder ver de un vistazo quién lo
 * abrió, con qué lectura y desde cuándo, sin tener que abrir el modal de
 * salida para enterarse. Es un concepto DISTINTO de "Estado de uso" (arriba,
 * asignación de operador/supervisor por id de usuario): acá `operador` es el
 * texto libre que se ingresó en la ENTRADA — puede no coincidir con
 * `equipo.operator`, y puede haber turno abierto sin ningún operador
 * asignado (o viceversa). No renderiza nada si no hay turno abierto.
 */
function TurnoEnCursoBanner({ equipo }: { equipo: EquipmentDetail }) {
  const { openShift } = equipo;
  if (!openShift) return null;
  const suffix = controlUnitSuffix(equipo.controlUnit);

  return (
    <Card className="border-(--accent) bg-accent-soft">
      <Card.Content className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-(--accent) text-white">
            <Clock className="h-4.25 w-4.25" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold tracking-wider text-accent-soft-foreground uppercase">
              Turno en curso · {turnoLabel(openShift.turno)}
            </span>
            <span className="text-sm font-semibold text-accent-soft-foreground">{openShift.operador}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-accent-soft-foreground">
          <span>
            Lectura inicial:{' '}
            <strong className="font-mono font-semibold">
              {NUMERO.format(openShift.valorInicial)} {suffix}
            </strong>
          </span>
          <span>Desde {formatFecha(openShift.fecha)}</span>
        </div>
      </Card.Content>
    </Card>
  );
}

/**
 * Ficha técnica del equipo (requerimientos §5.1), calcada 1:1 de
 * `FichaEquipoClientePC/Tablet/Phone.dc.html`: cabecera con foto, KPIs,
 * estado de uso (con asignar/liberar), datos de la unidad, combustible,
 * repuestos compatibles, actividad reciente y consumos de inventario — un
 * único árbol responsive (no 3 layouts separados): en `lg:` el cuerpo se
 * parte en 2 columnas (calcando el `640px 1fr` del artefacto PC), y por
 * debajo de `lg:` cae a una sola columna en el MISMO orden que los
 * artefactos tablet/celular.
 *
 * No es la "bitácora consolidada" de §5.5 — esa línea de tiempo que cruza los
 * eventos de todos los dominios es del bloque Núcleo (`FichaEquipoView`,
 * `/equipos/:id/ficha`); acá solo se muestra un adelanto (ver
 * `ActividadReciente`).
 */
export function EquipoDetalleView() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: equipo, isPending, isError, error } = useEquipmentDetail(id);
  const { role } = useCurrentUser();
  // `PATCH /equipment/:id/assignment` y `/status` solo los autoriza el
  // backend a ADMIN y SUPERVISOR — mismo gate que `updateStatus` en
  // `EquiposView`. Editar/eliminar la ficha completa (`EditEquipoModal`/
  // `DeleteEquipoAlertDialog`) es ADMIN únicamente, igual que `puedeEditarFicha`
  // en `EquiposView`.
  const puedeAsignar = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;
  const puedeCambiarEstado = puedeAsignar;
  const puedeEditarFicha = role === ROLES.ADMIN;
  const updateStatus = useUpdateEquipmentStatus();

  // `useHorometroList`/`useCombustibleList` no aceptan `equipoId` — traen el
  // historial completo (mismas queries que usa Terreno) y se filtra acá por
  // esta unidad. `RegistrarEntradaModal`/`RegistrarSalidaModal`/
  // `RegistrarCargaCombustibleModal` invalidan estas mismas queries al
  // guardar, así que esta ficha se refresca sola (ver el fix de invalidación
  // en `useHorometro`/`useCombustible`).
  const { data: horometros, isPending: isHorometroPending } = useHorometroList();
  const { data: combustibles, isPending: isCombustiblePending } = useCombustibleList();
  // Un solo estado para el botón de horómetro — `RegistrarHorometroModal`
  // decide internamente entre `RegistrarEntradaModal`/`RegistrarSalidaModal`
  // según `equipo.openShift`, mismo criterio que `EquipoCardMobile` en
  // `EquiposView`.
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isCargaOpen, setIsCargaOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // Orden del historial de cargas de combustible — "Más reciente primero" es
  // el default (`false`); el toggle de la cabecera de la sección invierte el
  // orden, calcando `fuelAsc`/`fuelOrderLabel` de `FichaEquipoClientePC.dc.html`.
  const [combustibleAsc, setCombustibleAsc] = useState(false);

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo cargar la ficha del equipo.'}
        </div>
        <Link className="text-sm text-(--accent) hover:underline" to="/equipos">
          ← Volver a equipos
        </Link>
      </div>
    );
  }

  const uso =
    equipo.controlUnit === 'HOURS'
      ? equipo.currentHourmeter != null
        ? `${NUMERO.format(equipo.currentHourmeter)} h`
        : '—'
      : equipo.currentMileage != null
        ? `${NUMERO.format(equipo.currentMileage)} km`
        : '—';

  // Más reciente primero — mismo criterio que la bitácora consolidada.
  const historialHorometro = (horometros ?? [])
    .filter((registro) => registro.equipoId === equipo.id)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const historialCombustible = (combustibles ?? [])
    .filter((registro) => registro.equipoId === equipo.id)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  // Vista de la tabla — respeta el toggle de orden; `historialCombustible`
  // (arriba) se mantiene siempre "más reciente primero" porque de ahí sale
  // la carga MÁS RECIENTE real para la caption de "Última carga", sin
  // importar cómo esté ordenada la tabla en pantalla.
  const historialCombustibleTabla = combustibleAsc ? [...historialCombustible].reverse() : historialCombustible;
  // El nivel de combustible se reporta junto a la lectura de horómetro, no
  // en la carga (ver `types/horometro.ts#nivelCombustible`) — el "último
  // nivel" es la lectura más reciente que trajo ese dato, no necesariamente
  // la lectura más reciente a secas. El VALOR mostrado viene de
  // `equipo.currentFuelLevel` (ya calculado por el backend, ver
  // `types/equipment.ts`); esta variable solo aporta el detalle de "quién y
  // cuándo" lo registró.
  const ultimaLecturaConNivel = historialHorometro.find((registro) => registro.nivelCombustible != null);
  const isFuelPending = isHorometroPending || isCombustiblePending;
  const fuelBadgeTone =
    equipo.currentFuelLevel != null ? FUEL_TONE_CLASSES[fuelTone(equipo.currentFuelLevel)].soft : undefined;
  // R3 (vista diferenciada por clase): patente destacada en pesados,
  // integrada en `marcaModelo` en livianos — fuente única, ver `flota-colors.ts`.
  const identidad = equipoIdentidad(equipo);

  return (
    <div className="flex flex-col gap-6">
      <Link
        className="w-fit text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase hover:underline"
        to="/equipos"
      >
        ← SMI · Flota
      </Link>

      {/* Cabecera: foto + código/estado + subtítulo, acciones a la derecha
         (calca la cabecera de FichaEquipoClientePC.dc.html: Cambiar estado,
         Registrar lectura, Editar equipo, Eliminar equipo — "Ver
         mantenciones" queda fuera, es dominio Mantenimiento sin API acá). */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <EquipoThumb alt={`Foto de ${equipo.internalCode}`} photoUrl={equipo.photoUrl} size="lg" />
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[26px] font-semibold tracking-[-0.01em] text-foreground sm:text-[32px]">
                {equipo.internalCode}
              </h1>
              {identidad.patenteDestacada ? (
                <span className="font-mono text-lg font-semibold text-foreground sm:text-xl">
                  {identidad.patenteDestacada}
                </span>
              ) : null}
              <StatusChip tone={equipmentStatusChipColor(equipo.status)}>
                {equipmentStatusLabel(equipo.status)}
              </StatusChip>
            </div>
            <p className="text-sm text-(--muted)">
              {equipo.type} · {identidad.marcaModelo}
              {equipo.year ? ` · ${equipo.year}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {puedeCambiarEstado ? (
            <Dropdown>
              <Button size="sm" variant="secondary">
                Cambiar estado
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                  disabledKeys={[equipo.status]}
                  onAction={(key) => {
                    updateStatus.mutate({ id: equipo.id, status: String(key) as EquipmentStatus });
                  }}
                >
                  {EQUIPMENT_STATUS.map((opcionEstado) => (
                    <Dropdown.Item
                      key={opcionEstado}
                      id={opcionEstado}
                      textValue={equipmentStatusLabel(opcionEstado)}
                    >
                      <Label>{equipmentStatusLabel(opcionEstado)}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : null}

          <Button onPress={() => setIsShiftModalOpen(true)} size="sm" variant="secondary">
            {registrarHorometroLabel(equipo)}
          </Button>

          {puedeEditarFicha ? (
            <Button onPress={() => setIsEditOpen(true)} size="sm">
              <Pencil className="h-4 w-4" />
              Editar equipo
            </Button>
          ) : null}

          {puedeEditarFicha ? (
            <Button
              aria-label="Eliminar equipo"
              isIconOnly
              onPress={() => setIsDeleteOpen(true)}
              size="sm"
              variant="danger"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Fila de KPIs — hero (uso acumulado) + combustible actual + los 4
         contadores por dominio que ya traía la ficha. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          caption={
            historialHorometro[0]
              ? `Última lectura: ${formatFechaCorta(historialHorometro[0].fecha)}`
              : 'Sin lecturas registradas'
          }
          hero
          icon={<Clock className="h-4.25 w-4.25" />}
          label={`${controlUnitLabel(equipo.controlUnit)} · uso`}
          value={uso}
        />
        <KpiTile
          caption={
            historialCombustible[0]
              ? `Última carga: ${formatFechaCorta(historialCombustible[0].fecha)}`
              : 'Sin cargas registradas'
          }
          icon={<Droplet className="h-4.25 w-4.25" />}
          label="Combustible actual"
          toneClass={fuelBadgeTone}
          value={equipo.currentFuelLevel != null ? `${NUMERO.format(equipo.currentFuelLevel)}%` : '—'}
        />
        <KpiTile
          caption="Registros de carga"
          icon={<Droplet className="h-4.25 w-4.25" />}
          label="Cargas combustible"
          value={String(equipo._count.combustibles)}
        />
        <KpiTile
          caption="Registros de horómetro"
          icon={<Clock className="h-4.25 w-4.25" />}
          label="Lecturas horómetro"
          value={String(equipo._count.horometros)}
        />
        <KpiTile
          caption="Horas extra en Terreno"
          icon={<Wrench className="h-4.25 w-4.25" />}
          label="Trabajos extra"
          value={String(equipo._count.trabajosExtra)}
        />
        <KpiTile
          caption="Reportados en Terreno"
          icon={<AlertTriangle className="h-4.25 w-4.25" />}
          label="Hallazgos"
          toneClass={equipo._count.hallazgos > 0 ? 'bg-danger-soft text-danger-soft-foreground' : undefined}
          value={String(equipo._count.hallazgos)}
        />
      </div>

      <TurnoEnCursoBanner equipo={equipo} />

      <EstadoDeUso equipo={equipo} puedeAsignar={puedeAsignar} />

      {/* Cuerpo en 2 columnas desde `lg:` (calca el `640px 1fr` de
         FichaEquipoClientePC.dc.html); por debajo, una sola columna en el
         MISMO orden que FichaEquipoClienteTablet/Phone.dc.html: Datos →
         Combustible → Repuestos → Actividad → Consumos. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[4fr_3fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <Card.Header>
              <Card.Title>Datos de la unidad</Card.Title>
            </Card.Header>
            <Card.Content className="mt-1 grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
              <Dato label="Código interno" value={equipo.internalCode} />
              <Dato label="Patente" value={equipo.licensePlate ?? '—'} />
              <Dato label="Clase" value={equipmentClassLabel(equipo.equipmentClass)} />
              <Dato label="Tipo" value={equipo.type} />
              <Dato label="Marca" value={equipo.brand} />
              <Dato label="Modelo" value={equipo.model} />
              <Dato label="Año" value={equipo.year ? String(equipo.year) : '—'} />
              <Dato label="Estado" value={equipmentStatusLabel(equipo.status)} />
              <Dato label="Unidad de control" value={controlUnitLabel(equipo.controlUnit)} />
              <Dato label="Uso acumulado" value={uso} />
              <Dato label="Sucursal base" value={equipo.homeBranch?.name ?? '—'} />
              <Dato label="Dado de alta" value={formatFecha(equipo.createdAt)} />
            </Card.Content>
          </Card>

          <DocumentsCard equipoId={equipo.id} puedeGestionar={puedeAsignar} />

          {/* Combustible: nivel actual (barra, mismo umbral de color que
             `FuelGauge`) + historial de cargas. El botón abre el flujo
             foto→OCR→EXIF (`RegistrarCargaCombustibleModal`, Fase B). */}
          <Card>
            <Card.Header>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Card.Title>Combustible</Card.Title>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onPress={() => setCombustibleAsc((prev) => !prev)} size="sm" variant="secondary">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {combustibleAsc ? 'Más antiguo primero' : 'Más reciente primero'}
                  </Button>
                  <Button onPress={() => setIsCargaOpen(true)} size="sm" variant="secondary">
                    Registrar carga
                  </Button>
                </div>
              </div>
            </Card.Header>

            <Card.Content className="mt-1 flex flex-col gap-4">
              {isFuelPending ? (
                <div className="flex justify-center py-6">
                  <Spinner color="accent" size="sm" />
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-[13px] font-semibold text-(--muted)">Nivel actual</span>
                      <span className="font-mono text-[19px] font-bold text-foreground">
                        {equipo.currentFuelLevel != null ? `${NUMERO.format(equipo.currentFuelLevel)}%` : '—'}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-tertiary">
                      {equipo.currentFuelLevel != null ? (
                        <div
                          className={`h-full rounded-full ${FUEL_TONE_CLASSES[fuelTone(equipo.currentFuelLevel)].bar}`}
                          style={{ width: `${Math.max(0, Math.min(100, equipo.currentFuelLevel))}%` }}
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-(--muted)">
                      {ultimaLecturaConNivel
                        ? `Registrado ${formatFecha(ultimaLecturaConNivel.fecha)} por ${ultimaLecturaConNivel.operador}`
                        : 'Esta unidad todavía no tiene lecturas de horómetro con nivel de combustible.'}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                      Historial de cargas
                    </p>
                    {historialCombustible.length > 0 ? (
                      <Table variant="secondary">
                        <Table.ScrollContainer>
                          <Table.Content aria-label="Historial de cargas de combustible" className="min-w-full">
                            <Table.Header>
                              <Table.Column isRowHeader>Fecha</Table.Column>
                              <Table.Column>Tipo</Table.Column>
                              <Table.Column className="text-right">Litros</Table.Column>
                            </Table.Header>
                            <Table.Body>
                              <Table.Collection items={historialCombustibleTabla}>
                                {(registro) => (
                                  <Table.Row>
                                    <Table.Cell className="text-sm text-(--muted)">
                                      {formatFecha(registro.fecha)}
                                    </Table.Cell>
                                    <Table.Cell>{TIPO_COMBUSTIBLE_LABEL[registro.tipo] ?? registro.tipo}</Table.Cell>
                                    <Table.Cell className="text-right font-mono text-sm font-semibold">
                                      {NUMERO.format(registro.litros)} L
                                    </Table.Cell>
                                  </Table.Row>
                                )}
                              </Table.Collection>
                            </Table.Body>
                          </Table.Content>
                        </Table.ScrollContainer>
                      </Table>
                    ) : (
                      <p className="text-sm text-(--muted)">
                        Esta unidad todavía no tiene cargas de combustible registradas.
                      </p>
                    )}
                  </div>
                </>
              )}
            </Card.Content>
          </Card>

          {/* Historial de horómetro: uso (horas-máquina, valorFinal −
             valorInicial) y duración real (fechaSalida − fecha) de cada
             turno — el turno abierto (si hay uno) ya se ve en el banner de
             arriba, así que acá se muestra igual con badge "En curso" en vez
             de omitirse, para no perder trazabilidad del historial completo. */}
          <Card>
            <Card.Header>
              <Card.Title>Horómetro</Card.Title>
              <Card.Description>Turnos registrados (entrada → salida) de esta unidad.</Card.Description>
            </Card.Header>
            <Card.Content className="mt-1">
              {isHorometroPending ? (
                <div className="flex justify-center py-6">
                  <Spinner color="accent" size="sm" />
                </div>
              ) : historialHorometro.length > 0 ? (
                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Historial de horómetro" className="min-w-full">
                      <Table.Header>
                        <Table.Column isRowHeader>Entrada</Table.Column>
                        <Table.Column>Operador</Table.Column>
                        <Table.Column>Turno</Table.Column>
                        <Table.Column className="text-right">Uso</Table.Column>
                        <Table.Column className="text-right">Duración</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        <Table.Collection items={historialHorometro}>
                          {(registro) => (
                            <Table.Row>
                              <Table.Cell className="text-sm text-(--muted)">{formatFecha(registro.fecha)}</Table.Cell>
                              <Table.Cell>{registro.operador}</Table.Cell>
                              <Table.Cell>{turnoLabel(registro.turno)}</Table.Cell>
                              <Table.Cell className="text-right font-mono text-sm font-semibold">
                                {registro.valorFinal != null
                                  ? `${NUMERO.format(registro.valorFinal - registro.valorInicial)} ${controlUnitSuffix(equipo.controlUnit)}`
                                  : 'En curso'}
                              </Table.Cell>
                              <Table.Cell className="text-right text-sm text-(--muted)">
                                {registro.fechaSalida
                                  ? formatDuracion(registro.fecha, registro.fechaSalida)
                                  : 'En curso'}
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Collection>
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <p className="text-sm text-(--muted)">
                  Esta unidad todavía no tiene lecturas de horómetro registradas.
                </p>
              )}
            </Card.Content>
          </Card>

          <RepuestosCompatiblesCard />
        </div>

        <div className="flex flex-col gap-4">
          <ActividadReciente equipoId={equipo.id} />

          <Card>
            <Card.Header>
              <Card.Title>Consumos de inventario</Card.Title>
              <Card.Description>
                Últimos materiales imputados a esta unidad ({equipo._count.stockMovements} en total).
              </Card.Description>
            </Card.Header>

            <Card.Content className="mt-1">
              {equipo.stockMovements.length > 0 ? (
                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Consumos de inventario" className="min-w-full">
                      <Table.Header>
                        <Table.Column isRowHeader>Insumo</Table.Column>
                        <Table.Column>Cantidad</Table.Column>
                        <Table.Column>Fecha</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        <Table.Collection items={equipo.stockMovements}>
                          {(movimiento) => (
                            <Table.Row>
                              <Table.Cell>
                                <span className="font-mono text-xs text-(--muted)">{movimiento.item.sku}</span>{' '}
                                {movimiento.item.name}
                              </Table.Cell>
                              <Table.Cell className="font-mono text-sm">
                                {movimiento.direction === 'OUT' ? '−' : '+'}
                                {NUMERO.format(movimiento.quantity)}
                              </Table.Cell>
                              <Table.Cell className="text-sm text-(--muted)">
                                {formatFecha(movimiento.occurredAt)}
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Collection>
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <p className="px-1 pb-2 text-sm text-(--muted)">
                  Esta unidad todavía no tiene consumos de inventario registrados.
                </p>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>

      <RegistrarHorometroModal equipo={equipo} isOpen={isShiftModalOpen} onOpenChange={setIsShiftModalOpen} />
      <RegistrarCargaCombustibleModal
        equipoId={equipo.id}
        equipoLabel={equipo.internalCode}
        isOpen={isCargaOpen}
        onOpenChange={setIsCargaOpen}
      />
      <EditEquipoModal equipo={equipo} isOpen={isEditOpen} onOpenChange={setIsEditOpen} />
      <DeleteEquipoAlertDialog
        equipo={equipo}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onDeleted={() => navigate('/equipos')}
      />
    </div>
  );
}
