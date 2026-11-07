import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Chip, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField } from '@heroui/react';

import { DecimalField } from '../DecimalField';
import { EQUIPMENT_CLASS_OPTIONS } from '../../config/flota-colors';
import { useCrearCargaCombustible } from '../../hooks/useCombustible';
import { useEquipment } from '../../hooks/useEquipment';
import { fechaRegistroIso, toDateTimeLocal } from '../../lib/format';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';
import type { EquipmentClass } from '../../types/equipment';
import { FotoRespaldoField } from './FotoRespaldoField';
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
    formState: { errors },
  } = useForm<CargaManualValues>({
    resolver: zodResolver(CargaManualSchema),
    defaultValues: {
      equipoId: '',
      litros: 0,
      lectura: 0,
      tipo: 'PETROLEO',
      fecha: toDateTimeLocal(new Date()),
    },
  });

  const equipos = (catalogo ?? [])
    .filter((equipo) => equipo.equipmentClass === clase)
    .sort((a, b) => a.internalCode.localeCompare(b.internalCode));

  // OCR de la foto (si hay) sugiere los litros, editable — mismo flujo que
  // Terreno.
  const photoFlow = usePhotoCaptureFlow((value) => setValue('litros', value, { shouldValidate: true }));

  // Con EXIF, la fecha real de captura reemplaza el "ahora" inicial; el campo
  // sigue editable (ver `RegistrarCargaCombustibleModal`).
  useEffect(() => {
    if (!photoFlow.file || photoFlow.isReadingPhoto) return;
    const capturada = photoFlow.captureDate ?? new Date();
    setValue('fecha', toDateTimeLocal(capturada), { shouldValidate: true });
  }, [photoFlow.file, photoFlow.isReadingPhoto, photoFlow.captureDate, setValue]);

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
  const puedeGuardar =
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
                    errorMessage={errors.litros?.message}
                    isInvalid={!!errors.litros}
                    label="Litros"
                    labelAddon={
                      ocrLeido ? (
                        ocrLeido.status === 'CONFIRMED' ? (
                          <Chip color="success" size="sm" variant="soft">
                            Leído de la foto
                          </Chip>
                        ) : ocrLeido.status === 'REVIEW' ? (
                          <Chip color="warning" size="sm" variant="soft">
                            ⚠️ Verificá el valor leído
                          </Chip>
                        ) : (
                          <Chip color="default" size="sm" variant="soft">
                            No se pudo leer la foto, ingresá los litros a mano
                          </Chip>
                        )
                      ) : undefined
                    }
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
                file={photoFlow.file}
                isReadingPhoto={photoFlow.isReadingPhoto}
                onClear={photoFlow.handleClearPhoto}
                onSelect={(f) => void photoFlow.handleSelectPhoto(f)}
                requerida={false}
                staleQuestion="¿es la carga registrada?"
                subtitle="Si la tenés, debe verse el totalizador del surtidor"
                title="Foto del surtidor (opcional)"
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
