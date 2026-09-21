import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form';
import { Camera, ImageIcon } from 'lucide-react';
import {
  AlertDialog,
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';

import { assetUrl, uploadImage } from '../../api/UploadsAPI';
import { useBranch, useBranches } from '../../hooks/useBranches';
import { useAssignEquipment, useDeleteEquipment, useUpdateEquipment } from '../../hooks/useEquipment';
import { useUsers } from '../../hooks/useUsers';
import { CONTROL_UNIT_OPTIONS, EQUIPMENT_CLASS_OPTIONS, EQUIPMENT_STATUS_OPTIONS } from '../../config/flota-colors';
import { ROLES } from '../../types/roles';
import {
  EquipmentFormSchema,
  toUpdateEquipmentPayload,
  type Equipment,
  type EquipmentClass,
  type EquipmentFormValues,
  type EquipmentStatus,
} from '../../types/equipment';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from './modal-styles';

/**
 * Extraído de `EquiposView.tsx` (Fase de fidelidad Flota/Equipos, §1): la
 * ficha de equipo (`EquipoDetalleView`) necesita las MISMAS acciones de
 * editar/eliminar que ya vivían en el kebab de la tabla/tarjetas — en vez de
 * duplicar el form completo (12 campos + pickers de asignación) se comparte
 * este módulo entre ambas vistas. `CreateEquipoModal` se queda en
 * `EquiposView.tsx` (la ficha no crea equipos), pero reusa `CamposEquipo`
 * de acá, así los campos siguen siendo una sola fuente.
 */

/** `null` (sin sucursal/asignar) no es un `id` válido para `Select` de
 * HeroUI — sentinels para los pickers de este form, compartidos por
 * `EquiposView` (`CreateEquipoModal`) y `EquipoDetalleView`. */
export const SIN_SUCURSAL = '__sin_sucursal__';
export const SIN_ASIGNAR = '__sin_asignar__';

/** Resuelve el sentinel del picker al id real (o `null`) que espera
 * `AssignEquipmentInput`. */
export function idDesdeSentinel(value: string): string | null {
  return value === SIN_ASIGNAR ? null : value;
}

/**
 * Banner de foto del equipo — header visual del modal de crear/editar (§2 de
 * la auditoría de fidelidad, PC): antes era un campo chico inline
 * (`EquipoPhotoField`, thumb + botón al lado, ver historial); ahora es una
 * franja ancha "cover" que sangra por fuera del padding del diálogo
 * (`-mx-6 -mt-6`, cancela el `p-6` de `Modal.Dialog`) hasta sus bordes —
 * mismo truco que un cover de perfil. Vive FUERA de `CamposEquipo` (se
 * renderiza antes de `Modal.Header`, no dentro de `Modal.Body`) para poder
 * sangrar hasta arriba de todo el diálogo; sigue sin subir nada hasta que el
 * usuario elige un archivo (`uploadImage`), mismo patrón de subida inmediata
 * que `PhotoDropzone` (`components/terreno/mobile.tsx`).
 */
export function EquipoPhotoBanner({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const src = assetUrl(value);

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setIsUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch {
      toast.danger('No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="-mx-6 -mt-6 mb-5 flex flex-col overflow-hidden">
      <div className="flex h-36 w-full items-center justify-center bg-surface-tertiary sm:h-44">
        {src ? (
          <img alt="Foto del equipo" className="h-full w-full object-cover" src={src} />
        ) : (
          <ImageIcon aria-hidden className="h-10 w-10 text-(--muted)" />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-secondary px-6 py-3">
        <span className="text-xs text-(--muted)">JPG o PNG · sirve para identificar el equipo de un vistazo.</span>
        <Button
          isPending={isUploading}
          size="sm"
          type="button"
          variant="secondary"
          onPress={() => inputRef.current?.click()}
        >
          {({ isPending }) =>
            isPending ? (
              <Spinner color="current" size="sm" />
            ) : (
              <>
                <Camera className="h-4 w-4" />
                {value ? 'Cambiar foto' : 'Subir foto'}
              </>
            )
          }
        </Button>
      </div>
      <input
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}

interface CamposProps {
  control: Control<EquipmentFormValues>;
  errors: FieldErrors<EquipmentFormValues>;
  /** El código interno es la clave de negocio: se fija al crear y el backend
   * no lo edita. */
  internalCodeEditable: boolean;
  /** Sucursal asignada HOY al equipo que se está editando (`undefined` en
   * creación). Existe para el caso borde de la sucursal base: el selector
   * solo ofrece sucursales activas, pero si el equipo quedó homed a una que
   * mientras tanto pasó a inactiva, igual debe verse seleccionada — si no,
   * el `Select` queda en blanco aunque el campo sí tenga valor. */
  currentHomeBranchId?: string | null;
  /** Asignación actual (operador/supervisor) — vive FUERA del form de RHF
   * porque se guarda con una mutación aparte (`useAssignEquipment`, ver
   * `CreateEquipoModal`/`EditEquipoModal`). Sentinels `SIN_ASIGNAR`. */
  operatorId: string;
  onOperatorIdChange: (id: string) => void;
  supervisorId: string;
  onSupervisorIdChange: (id: string) => void;
}

/**
 * Campos del equipo, compartidos por el modal de creación (`EquiposView`) y
 * el de edición (`EditEquipoModal`, acá abajo, usado también desde la ficha)
 * — se extraen en vez de duplicarse porque son varios y la única diferencia
 * entre ambos formularios es si `internalCode` se puede escribir.
 */
export function CamposEquipo({
  control,
  errors,
  internalCodeEditable,
  currentHomeBranchId,
  operatorId,
  onOperatorIdChange,
  supervisorId,
  onSupervisorIdChange,
}: CamposProps) {
  // El selector de sucursal base solo debe ofrecer sucursales activas.
  const { data: sucursalesActivas } = useBranches({ isActive: true });
  // Solo se pide si estamos editando (ver `currentHomeBranchId`); `useBranch`
  // ya trae `enabled: !!id`, así que en creación (`undefined`) no dispara nada.
  const { data: sucursalActual } = useBranch(currentHomeBranchId ?? '');
  const yaEstaEnActivas = (sucursalesActivas ?? []).some((sucursal) => sucursal.id === sucursalActual?.id);
  const opcionesSucursal =
    sucursalActual && !yaEstaEnActivas ? [...(sucursalesActivas ?? []), sucursalActual] : (sucursalesActivas ?? []);

  // Pickers de asignación — operador (rol OPERADOR) y supervisor (rol
  // SUPERVISOR); cada uno cachea aparte gracias al filtro de `useUsers`.
  const { data: operadores } = useUsers({ role: ROLES.OPERADOR });
  const { data: supervisores } = useUsers({ role: ROLES.SUPERVISOR });

  return (
    <div className="flex flex-col gap-5">
      {/* El banner de foto (`EquipoPhotoBanner`) ya no vive acá — se renderiza
         antes de `Modal.Header` en `CreateEquipoModal`/`EditEquipoModal` para
         poder sangrar hasta el borde del diálogo (§2, PC). */}

      {/* Rediseño v3 (feedback de Benjamin: la v2 de 2 columnas fijas se veía
         angosta y desordenada): los 10 campos ya no van en pares fijos, cada
         uno en su propio `<div className="grid ...">` de 2 columnas — ahora
         se agrupan en 4 secciones con encabezado (`.label`, mismo estilo que
         ya usaba "Datos de la unidad"/"Asignación") y UNA grilla compartida
         por sección que reflowa sola: 1 columna en celular, 2 en tablet, 3 en
         PC ancho (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`). Cada sección
         salvo la primera repite el divisor `border-t border-separator pt-4`
         que ya usaba la sección de Asignación, para separar por jerarquía sin
         caer en cards anidadas (impeccable/product: grillas predecibles +
         secciones por jerarquía, no "wrap everything in a container"). */}
      <section className="flex flex-col gap-3">
        <p className="label">Identificación</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Controller
            control={control}
            name="internalCode"
            render={({ field }) => (
              <TextField
                fullWidth
                isDisabled={!internalCodeEditable}
                isInvalid={!!errors.internalCode}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Código interno</Label>
                <Input autoFocus={internalCodeEditable} placeholder="EX-001" />
                {errors.internalCode ? <FieldError>{errors.internalCode.message}</FieldError> : null}
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="licensePlate"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.licensePlate}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Patente (opcional)</Label>
                <Input placeholder="AB-CD-12" />
                {errors.licensePlate ? <FieldError>{errors.licensePlate.message}</FieldError> : null}
              </TextField>
            )}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-separator pt-4">
        <p className="label">Clasificación</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Controller
            control={control}
            name="equipmentClass"
            render={({ field }) => (
              <Select
                fullWidth
                isInvalid={!!errors.equipmentClass}
                name={field.name}
                value={field.value}
                onChange={(value) => {
                  if (value) field.onChange(value as EquipmentClass);
                }}
              >
                <Label>Clase</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {EQUIPMENT_CLASS_OPTIONS.map((option) => (
                      <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
                {errors.equipmentClass ? <FieldError>{errors.equipmentClass.message}</FieldError> : null}
              </Select>
            )}
          />

          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.type}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Tipo</Label>
                <Input placeholder="Excavadora, Camión, Cargador…" />
                {errors.type ? <FieldError>{errors.type.message}</FieldError> : null}
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="brand"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.brand}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Marca</Label>
                <Input placeholder="Caterpillar" />
                {errors.brand ? <FieldError>{errors.brand.message}</FieldError> : null}
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="model"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.model}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Modelo</Label>
                <Input placeholder="336" />
                {errors.model ? <FieldError>{errors.model.message}</FieldError> : null}
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="year"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.year}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Año (opcional)</Label>
                <Input inputMode="numeric" placeholder="2019" />
                {errors.year ? <FieldError>{errors.year.message}</FieldError> : null}
              </TextField>
            )}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-separator pt-4">
        <p className="label">Operación</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Controller
            control={control}
            name="controlUnit"
            render={({ field }) => (
              <Select
                fullWidth
                isInvalid={!!errors.controlUnit}
                name={field.name}
                value={field.value}
                onChange={(value) => {
                  if (value) field.onChange(value);
                }}
              >
                <Label>Unidad de control</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {CONTROL_UNIT_OPTIONS.map((option) => (
                      <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
                {errors.controlUnit ? <FieldError>{errors.controlUnit.message}</FieldError> : null}
              </Select>
            )}
          />

          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                fullWidth
                isInvalid={!!errors.status}
                name={field.name}
                value={field.value}
                onChange={(value) => {
                  if (value) field.onChange(value as EquipmentStatus);
                }}
              >
                <Label>Estado</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                      <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
                {errors.status ? <FieldError>{errors.status.message}</FieldError> : null}
              </Select>
            )}
          />

          <Controller
            control={control}
            name="homeBranchId"
            render={({ field }) => (
              <Select
                fullWidth
                isInvalid={!!errors.homeBranchId}
                name={field.name}
                value={field.value || SIN_SUCURSAL}
                onChange={(value) => {
                  if (value) field.onChange(value === SIN_SUCURSAL ? '' : value);
                }}
              >
                <Label>Sucursal base (opcional)</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id={SIN_SUCURSAL} textValue="Sin sucursal">
                      Sin sucursal
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {opcionesSucursal.map((sucursal) => (
                      <ListBox.Item key={sucursal.id} id={sucursal.id} textValue={sucursal.name}>
                        {sucursal.name}
                        {!sucursal.isActive ? (
                          <span className="text-(--muted)"> (inactiva)</span>
                        ) : null}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
                {errors.homeBranchId ? <FieldError>{errors.homeBranchId.message}</FieldError> : null}
              </Select>
            )}
          />
        </div>
      </section>

      {/* `border-t border-separator pt-4`: mismo divisor que ya usa
         `AsignacionForm` en `EquipoDetalleView.tsx` para separar la sección
         de asignación del resto — acá cumple el mismo rol de jerarquía entre
         secciones que ya usaba antes de este rediseño. */}
      <section className="flex flex-col gap-3 border-t border-separator pt-4">
        <p className="label">Asignación</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Select fullWidth value={operatorId} onChange={(value) => value && onOperatorIdChange(String(value))}>
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

          <Select fullWidth value={supervisorId} onChange={(value) => value && onSupervisorIdChange(String(value))}>
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
      </section>

      {/* R1/R2 (revisión técnica/seguro): ambos opcionales, se puede guardar
         el equipo sin fecha cargada. `type="date"` calca el patrón que ya
         usa el filtro "Desde"/"Hasta" de `MovimientosView.tsx` — consistencia
         de input de fecha en todo el proyecto. */}
      <section className="flex flex-col gap-3 border-t border-separator pt-4">
        <p className="label">Documentos</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Controller
            control={control}
            name="technicalInspectionExpiry"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.technicalInspectionExpiry}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                type="date"
                value={field.value}
              >
                <Label>Vencimiento revisión técnica (opcional)</Label>
                <Input />
                {errors.technicalInspectionExpiry ? (
                  <FieldError>{errors.technicalInspectionExpiry.message}</FieldError>
                ) : null}
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="insuranceExpiry"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.insuranceExpiry}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                type="date"
                value={field.value}
              >
                <Label>Vencimiento seguro (opcional)</Label>
                <Input />
                {errors.insuranceExpiry ? <FieldError>{errors.insuranceExpiry.message}</FieldError> : null}
              </TextField>
            )}
          />
        </div>
      </section>
    </div>
  );
}

export interface EquipoModalProps {
  equipo: Equipment;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** Convierte un ISO datetime (`equipo.technicalInspectionExpiry`/
 * `insuranceExpiry`, ej. `"2026-12-01T00:00:00.000Z"`) al formato que espera
 * `<Input type="date">` (`"2026-12-01"`), o `''` (sentinel de "vacío" que ya
 * usa el resto del form — `licensePlate`/`homeBranchId`) cuando no hay fecha
 * cargada. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

/** Deriva los `EquipmentFormValues` desde el equipo — la misma forma la usa
 * `values` del `useForm` (re-sync mientras el modal está abierto, p. ej. si
 * la tabla se refresca) y el `reset` explícito al abrir (ver más abajo, Fix 1
 * del review QA: sin ese `reset` imperativo, cancelar sin guardar y reabrir
 * dejaba los campos editados a medias, porque `values` solo re-sincroniza
 * cuando el `equipo` en sí cambia, no cuando el usuario descarta su edición). */
function buildEquipoFormValues(equipo: Equipment): EquipmentFormValues {
  return {
    internalCode: equipo.internalCode,
    licensePlate: equipo.licensePlate ?? '',
    equipmentClass: equipo.equipmentClass,
    type: equipo.type,
    brand: equipo.brand,
    model: equipo.model,
    year: equipo.year ? String(equipo.year) : '',
    controlUnit: equipo.controlUnit,
    status: equipo.status,
    homeBranchId: equipo.homeBranchId ?? '',
    photoUrl: equipo.photoUrl,
    technicalInspectionExpiry: toDateInputValue(equipo.technicalInspectionExpiry),
    insuranceExpiry: toDateInputValue(equipo.insuranceExpiry),
  };
}

export function EditEquipoModal({ equipo, isOpen, onOpenChange }: EquipoModalProps) {
  const updateEquipment = useUpdateEquipment();
  const assignEquipment = useAssignEquipment();
  const [operatorId, setOperatorId] = useState(equipo.operator?.id ?? SIN_ASIGNAR);
  const [supervisorId, setSupervisorId] = useState(equipo.supervisor?.id ?? SIN_ASIGNAR);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(EquipmentFormSchema),
    // `values` (no `defaultValues`): el modal vive montado en la fila, así que
    // el form debe re-sincronizarse cuando la tabla se refresca.
    values: buildEquipoFormValues(equipo),
  });

  // El modal vive montado en la fila (solo `Modal.Backdrop isOpen` controla
  // su visibilidad) — re-sincroniza pickers Y campos del form con el equipo
  // real cada vez que se abre. El `reset` explícito es necesario porque
  // `values` (arriba) solo dispara un re-sync cuando el `equipo` cambia de
  // verdad: si el usuario edita texto y cancela sin guardar, `equipo` sigue
  // igual, así que sin este efecto los campos editados quedarían "pegados"
  // la próxima vez que se abre el modal (Fix 1, review QA).
  useEffect(() => {
    if (isOpen) {
      setOperatorId(equipo.operator?.id ?? SIN_ASIGNAR);
      setSupervisorId(equipo.supervisor?.id ?? SIN_ASIGNAR);
      reset(buildEquipoFormValues(equipo));
    }
  }, [isOpen, equipo, reset]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_WIDE_CLASS}>
          {({ close }) => {
            // Encadenado (no fire-and-forget): antes la asignación se
            // disparaba sin `await` y el modal cerraba de inmediato con el
            // toast de éxito de `updateEquipment` — si `assignEquipment`
            // fallaba (p. ej. el operador perdió el rol), el modal ya había
            // cerrado y el cambio de asignación se perdía en silencio (Fix 2,
            // review QA). Ahora ambas mutaciones deben resolver OK para
            // cerrar; si cualquiera falla, el modal queda abierto (su propio
            // `onError` ya muestra el toast de danger) para que el usuario
            // vea el error y pueda reintentar.
            const onSubmit = async (values: EquipmentFormValues): Promise<void> => {
              try {
                await updateEquipment.mutateAsync({ id: equipo.id, input: toUpdateEquipmentPayload(values) });

                const operatorIdFinal = idDesdeSentinel(operatorId);
                const supervisorIdFinal = idDesdeSentinel(supervisorId);
                const cambioAsignacion =
                  operatorIdFinal !== (equipo.operator?.id ?? null) ||
                  supervisorIdFinal !== (equipo.supervisor?.id ?? null);
                if (cambioAsignacion) {
                  await assignEquipment.mutateAsync({
                    id: equipo.id,
                    input: { operatorId: operatorIdFinal, supervisorId: supervisorIdFinal },
                  });
                }

                close();
              } catch {
                // No-op: cada mutación ya toasteó el error por su cuenta
                // (`useUpdateEquipment`/`useAssignEquipment`). Acá solo se
                // evita cerrar el modal para no enmascarar el fallo.
              }
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Controller
                  control={control}
                  name="photoUrl"
                  render={({ field }) => <EquipoPhotoBanner onChange={field.onChange} value={field.value} />}
                />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar {equipo.internalCode}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`edit-equipo-form-${equipo.id}`}
                    noValidate
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                  >
                    <CamposEquipo
                      control={control}
                      currentHomeBranchId={equipo.homeBranchId}
                      errors={errors}
                      internalCodeEditable={false}
                      onOperatorIdChange={setOperatorId}
                      onSupervisorIdChange={setSupervisorId}
                      operatorId={operatorId}
                      supervisorId={supervisorId}
                    />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    form={`edit-equipo-form-${equipo.id}`}
                    isPending={updateEquipment.isPending}
                    type="submit"
                  >
                    {({ isPending }) =>
                      isPending ? <Spinner color="current" size="sm" /> : 'Guardar cambios'
                    }
                  </Button>
                </Modal.Footer>
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export interface DeleteEquipoAlertDialogProps extends EquipoModalProps {
  /** Se dispara DESPUÉS de cerrar el diálogo, solo cuando el borrado tuvo
   * éxito — la ficha (`EquipoDetalleView`) la usa para navegar de vuelta a
   * `/equipos` (la unidad que se estaba viendo ya no existe, así que
   * `useEquipmentDetail` refetchearía un 404 si se quedara montada). En
   * `EquiposView` no hace falta: el equipo simplemente desaparece de la
   * lista al refrescar. */
  onDeleted?: () => void;
}

export function DeleteEquipoAlertDialog({ equipo, isOpen, onOpenChange, onDeleted }: DeleteEquipoAlertDialogProps) {
  const deleteEquipment = useDeleteEquipment();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>¿Eliminar {equipo.internalCode}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Esta acción no se puede deshacer. Si la unidad ya tiene registros de terreno,
                  mantenciones o consumos, el sistema la rechazará: en ese caso, cámbiala a{' '}
                  <strong>Fuera de servicio</strong> para retirarla conservando su historial.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isPending={deleteEquipment.isPending}
                  variant="danger"
                  onPress={() => {
                    deleteEquipment.mutate(equipo.id, {
                      onSuccess: () => {
                        close();
                        onDeleted?.();
                      },
                    });
                  }}
                >
                  {deleteEquipment.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
