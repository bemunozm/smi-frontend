import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField } from '@heroui/react';

import { DecimalField } from '../DecimalField';
import { revisarLitros } from '../../lib/litros';
import { EQUIPMENT_CLASS_OPTIONS } from '../../config/flota-colors';
import { useCrearCargaCombustible } from '../../hooks/useCombustible';
import { useEquipment } from '../../hooks/useEquipment';
import { fechaRegistroIso, toDateTimeLocal } from '../../lib/format';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';
import type { EquipmentClass } from '../../types/equipment';
import { FotoRespaldoField } from './FotoRespaldoField';
import { OcrLitrosChip } from './OcrLitrosChip';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const TIPO_OPTIONS = [
  { value: 'PETROLEO', label: 'Petróleo' },
  { value: 'BENCINA', label: 'Bencina' },
] as const;

// Schema local de la UI — mismo criterio que `RegistrarCargaCombustibleModal`
// (litros controlado por `DecimalField` necesita `number`).
const CargaManualSchema = z.object({
  equipoId: z.string().min(1, 'Elegí un equipo'),
  litros: z.number().positive('Litros debe ser mayor a 0'),
  // Lectura del contador al cargar (pedido del cliente): horómetro si el
  // equipo es pesado, kilometraje si es liviano.
  lectura: z.number().positive('Ingresá la lectura del contador'),
  tipo: z.enum(['PETROLEO', 'BENCINA']),
  fecha: z.string().min(1, 'Requerido'),
});
type CargaManualValues = z.infer<typeof CargaManualSchema>;

/**
 * Alta manual de una carga desde el panel admin (`CargasCombustibleAdminView`),
 * para CUALQUIER equipo: el selector de clase (liviano/pesado) filtra el de
 * equipo. A diferencia del registro de Terreno
 * (`RegistrarCargaCombustibleModal`), la foto es OPCIONAL — el administrador
 * registra cargas que le llegan por otros medios y puede no tener la foto a
 * mano — y el POST es online directo (`useCrearCargaCombustible`), sin outbox.
 * Con foto, el OCR sugiere los litros y el EXIF corrige la fecha; sin foto, la
 * fecha parte en "ahora" y queda editable para cargas pasadas.
 */
export function NuevaCargaCombustibleModal({ onClose }: { onClose: () => void }) {
  const crear = useCrearCargaCombustible();
  const { data: catalogo } = useEquipment();
  const [clase, setClase] = useState<EquipmentClass>('HEAVY');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<CargaManualValues>({
    resolver: zodResolver(CargaManualSchema),
    defaultValues: { equipoId: '', litros: 0, lectura: 0, tipo: 'PETROLEO', fecha: toDateTimeLocal(new Date()) },
  });

  const equipos = (catalogo ?? [])
    .filter((equipo) => equipo.equipmentClass === clase)
    .sort((a, b) => a.internalCode.localeCompare(b.internalCode));

  // OCR de la foto (si hay) sugiere los litros, editable — mismo flujo que
  // Terreno.
  // Solo si los litros no se escribieron a mano: aquí llegan registros
  // anteriores con foto del papel, y una lectura mala del OCR no debe pisar
  // lo que el administrador ya tipeó.
  const photoFlow = usePhotoCaptureFlow((value) => {
    if (!getFieldState('litros').isDirty) setValue('litros', value, { shouldValidate: true });
  });

  // Con EXIF, la fecha real de captura reemplaza el "ahora" inicial; sin
  // EXIF, vuelve a "ahora" (así una foto REEMPLAZADA no deja la fecha EXIF de
  // la descartada — «Reemplazar foto» no pasa por `onClear`). En ambos casos
  // solo si la fecha no se tocó: un registro anterior (foto del papel, sin
  // EXIF, o sacada hoy a un papel viejo) quedaba con la fecha de hoy aunque
  // el administrador ya hubiera puesto la del día de la carga.
  useEffect(() => {
    if (!photoFlow.file || photoFlow.isReadingPhoto) return;
    if (getFieldState('fecha').isDirty) return;
    setValue('fecha', toDateTimeLocal(photoFlow.captureDate ?? new Date()), { shouldValidate: true });
  }, [photoFlow.file, photoFlow.isReadingPhoto, photoFlow.captureDate, setValue, getFieldState]);

  // Quitar la foto también retira lo que se llenó DESDE ella (fecha EXIF,
  // litros OCR): un registro no puede quedar fechado/litrado por evidencia
  // que se descartó. Lo tipeado a mano (dirty) sí se conserva.
  const quitarFoto = () => {
    photoFlow.handleClearPhoto();
    if (!getFieldState('fecha').isDirty) setValue('fecha', toDateTimeLocal(new Date()), { shouldValidate: true });
    if (!getFieldState('litros').isDirty) setValue('litros', 0, { shouldValidate: false });
  };

  const cerrar = () => {
    photoFlow.resetPhoto();
    onClose();
  };

  const ocrLeido = photoFlow.file && !photoFlow.isReadingPhoto ? photoFlow.ocr : null;

  const litros = watch('litros');
  const lectura = watch('lectura');
  const equipoId = watch('equipoId');
  // `fechaRegistroIso` da null con la fecha vacía, no-fecha o futura: el
  // backend rechazaría una futura y esta vista no tiene edición para
  // corregirla después — se bloquea acá (mismo patrón que el alta del panel
  // de Trabajos extra y Hallazgos).
  const fechaIso = fechaRegistroIso(watch('fecha'));
  // Litros imposibles para la clase (48493 en vez de 48,493): bloquea en camioneta, avisa en pesado.
  const revisionLitros = revisarLitros(litros, { liviano: clase === 'LIGHT' });
  const puedeGuardar =
    revisionLitros.error == null &&
    equipoId !== '' &&
    fechaIso !== null &&
    !photoFlow.isReadingPhoto &&
    !crear.isPending &&
    Number.isFinite(litros) &&
    litros > 0 &&
    Number.isFinite(lectura) &&
    lectura > 0;

  const onSubmit = (values: CargaManualValues) => {
    const iso = fechaRegistroIso(values.fecha);
    if (!iso) return;
    crear.mutate(
      {
        values: {
          equipoId: values.equipoId,
          litros: values.litros,
          tipo: values.tipo,
          fecha: iso,
          lectura: values.lectura,
        },
        foto: photoFlow.file ?? null,
      },
      { onSuccess: cerrar },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable={!crear.isPending}
      isOpen
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={crear.isPending} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Nueva carga de combustible
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4"
              id="nueva-carga-form"
              noValidate
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              <Select
                fullWidth
                value={clase}
                onChange={(value) => {
                  if (!value) return;
                  setClase(value as EquipmentClass);
                  // La camioneta elegida no puede quedar colgando al pasar a
                  // pesados (ni al revés) — y una lectura tipeada para la otra
                  // clase (km vs h) menos todavía.
                  setValue('equipoId', '', { shouldValidate: false });
                  setValue('lectura', 0, { shouldValidate: false });
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
              </Select>

              <Controller
                control={control}
                name="equipoId"
                render={({ field }) => (
                  <Select
                    fullWidth
                    name={field.name}
                    placeholder="Elegir equipo"
                    value={field.value}
                    onChange={(value) => {
                      if (value) field.onChange(String(value));
                    }}
                  >
                    <Label>Equipo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {equipos.map((equipo) => (
                          <ListBox.Item
                            key={equipo.id}
                            id={equipo.id}
                            textValue={`${equipo.internalCode} — ${equipo.type}`}
                          >
                            {equipo.internalCode} — {equipo.type}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              />

              <Controller
                control={control}
                name="lectura"
                render={({ field }) => (
                  <DecimalField
                    errorMessage={errors.lectura?.message}
                    isInvalid={!!errors.lectura}
                    // Pedido del cliente: al cargar un pesado se anota el
                    // horómetro; un liviano, el kilometraje.
                    label={clase === 'LIGHT' ? 'Kilometraje al cargar (km)' : 'Horómetro al cargar (h)'}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    value={field.value}
                  />
                )}
              />

              <Controller
                control={control}
                name="litros"
                render={({ field }) => (
                  <DecimalField
                    decimales={3}
                    errorMessage={errors.litros?.message ?? revisionLitros.error ?? undefined}
                    isInvalid={!!errors.litros || revisionLitros.error != null}
                    label="Litros"
                    litros
                    warning={revisionLitros.aviso ?? undefined}
                    labelAddon={ocrLeido ? <OcrLitrosChip litros={litros} ocr={ocrLeido} /> : undefined}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    value={field.value}
                  />
                )}
              />

              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select
                    fullWidth
                    name={field.name}
                    value={field.value}
                    onChange={(value) => {
                      if (value) field.onChange(value);
                    }}
                  >
                    <Label>Tipo de combustible</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {TIPO_OPTIONS.map((option) => (
                          <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                            {option.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              />

              <Controller
                control={control}
                name="fecha"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={!!errors.fecha || fechaIso === null}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    type="datetime-local"
                    value={field.value}
                  >
                    <Label>Fecha de carga</Label>
                    <Input max={toDateTimeLocal(new Date())} />
                    {errors.fecha ? <FieldError>{errors.fecha.message}</FieldError> : null}
                  </TextField>
                )}
              />

              <FotoRespaldoField
                captureDate={photoFlow.captureDate}
                fechaEditable
                file={photoFlow.file}
                isReadingPhoto={photoFlow.isReadingPhoto}
                onClear={quitarFoto}
                onSelect={(f) => void photoFlow.handleSelectPhoto(f)}
                requerida={false}
                staleQuestion="¿es la carga registrada?"
                subtitle="Del surtidor o, si es una carga anterior, del registro en papel"
                title="Foto de la carga (opcional)"
              />
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={crear.isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button form="nueva-carga-form" isDisabled={!puedeGuardar} isPending={crear.isPending} type="submit">
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar carga')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
