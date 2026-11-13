import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField } from '@heroui/react';

import { DecimalField } from '../DecimalField';
import { revisarLitros } from '../../lib/litros';
import { useCreateCombustible } from '../../hooks/useCombustible';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';
import { FotoRespaldoField } from './FotoRespaldoField';
import { OcrLitrosChip } from './OcrLitrosChip';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const TIPO_OPTIONS = [
  { value: 'PETROLEO', label: 'Petróleo' },
  { value: 'BENCINA', label: 'Bencina' },
] as const;

// Schema local de la UI — ver la nota equivalente en `RegistrarEntradaModal`
// sobre por qué no se reutiliza `combustibleFormSchema` tal cual (litros
// controlado por `DecimalField` necesita `number`, no `number | undefined`).
const CargaSchema = z.object({
  litros: z.number().positive('Litros debe ser mayor a 0'),
  tipo: z.enum(['PETROLEO', 'BENCINA']),
  fecha: z.string().min(1, 'Requerido'),
});
type CargaFormValues = z.infer<typeof CargaSchema>;

const DEFAULT_VALUES: CargaFormValues = { litros: 0, tipo: 'PETROLEO', fecha: '' };

/** Convierte un `Date` al formato LOCAL que espera `<input type="datetime-local">`
 * (`"YYYY-MM-DDTHH:mm"`, en la zona horaria del dispositivo — no UTC). Se usa
 * solo para precargar el campo; al enviar, ese string local se reconvierte a
 * ISO (`new Date(local).toISOString()`) en el payload. */
function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface RegistrarCargaCombustibleModalProps {
  equipoId: string;
  /** Código interno del equipo, solo para el título del modal. */
  equipoLabel?: string;
  /** Camioneta: los litros imposibles (48493) bloquean; en un pesado solo avisan. */
  liviano?: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Registro de carga de combustible con trazabilidad anti-falsificación: la
 * foto es obligatoria, de ella se autorrellena los litros por OCR (editable)
 * y se valida la fecha real de captura vía EXIF. A diferencia de la lectura
 * de horómetro, acá la foto SÍ se sube y queda archivada (`fotoUrl` existe en
 * `RegistroCombustible` — ver `types/combustible.ts`). "Fecha de carga"
 * (`fecha`) se autorrellena del mismo EXIF (o "ahora" si la foto no lo trae)
 * y queda editable — es lo que el backend persiste como `RegistroCombustible.fecha`
 * en vez de su `@default(now())`.
 */
export function RegistrarCargaCombustibleModal({
  equipoId,
  equipoLabel,
  liviano = false,
  isOpen,
  onOpenChange,
}: RegistrarCargaCombustibleModalProps) {
  const crear = useCreateCombustible();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<CargaFormValues>({ resolver: zodResolver(CargaSchema), defaultValues: DEFAULT_VALUES });

  // Orquestación foto→OCR→EXIF+subida compartida con `RegistrarEntradaModal`/
  // `RegistrarSalidaModal` — ver `usePhotoCaptureFlow`. La lectura sugerida
  // por OCR autorrellena `litros`, pero solo si no se escribieron a mano: una
  // lectura mala del OCR de una foto reemplazada no debe pisar lo tipeado
  // (mismo guard que `NuevaCargaCombustibleModal`).
  const photoFlow = usePhotoCaptureFlow((value) => {
    if (!getFieldState('litros').isDirty) setValue('litros', value, { shouldValidate: true });
  });

  // Pre-relleno automático de "Fecha de carga": se dispara cuando termina la
  // lectura EXIF+OCR de la foto recién elegida (`isReadingPhoto` pasa a
  // `false`). Con EXIF, usa la fecha real de captura; sin EXIF (`captureDate
  // === null`), usa "ahora". Solo si la fecha no se tipeó a mano — una carga
  // de un día anterior se fecha a mano y la foto del papel no debe pisarla.
  useEffect(() => {
    if (!photoFlow.file || photoFlow.isReadingPhoto) return;
    if (getFieldState('fecha').isDirty) return;
    const capturada = photoFlow.captureDate ?? new Date();
    setValue('fecha', toLocalDateTimeInputValue(capturada), { shouldValidate: true });
  }, [photoFlow.file, photoFlow.isReadingPhoto, photoFlow.captureDate, setValue, getFieldState]);

  // Quitar la foto también retira lo que se llenó DESDE ella (fecha EXIF,
  // litros OCR): un registro no puede quedar fechado/litrado por evidencia
  // que se descartó. Lo tipeado a mano (dirty) sí se conserva.
  const quitarFoto = () => {
    photoFlow.handleClearPhoto();
    if (!getFieldState('fecha').isDirty) setValue('fecha', DEFAULT_VALUES.fecha, { shouldValidate: false });
    if (!getFieldState('litros').isDirty) setValue('litros', DEFAULT_VALUES.litros, { shouldValidate: false });
  };

  const limpiarTodo = () => {
    reset(DEFAULT_VALUES);
    photoFlow.resetPhoto();
  };

  // Único punto de cierre: "Cancelar" y el backdrop/ESC/botón X pasan por
  // acá (mismo motivo que en `RegistrarEntradaModal`: sin limpiar, el modal
  // reutilizado filtraría foto/OCR/litros de un equipo a otro). También es
  // el gatillo que limpia la foto elegida.
  const cerrar = () => {
    limpiarTodo();
    onOpenChange(false);
  };

  // El OCR queda "leído" recién cuando terminó de analizar la foto elegida —
  // antes de eso (`isReadingPhoto`) no corresponde mostrar ni chip ni aviso.
  // `photoFlow.ocr` se guarda completo aunque `value` sea `null` (ver
  // `usePhotoCaptureFlow`), así que acá se decide qué chip mostrar según el
  // `status` del ensemble (CONFIRMED/REVIEW/UNREADABLE) de ese resultado.
  const ocrLeido = photoFlow.file && !photoFlow.isReadingPhoto ? photoFlow.ocr : null;

  const litros = watch('litros');
  const revisionLitros = revisarLitros(litros, { liviano });
  const puedeGuardar =
    revisionLitros.error == null &&
    !!photoFlow.file && !photoFlow.isReadingPhoto && !crear.isPending && Number.isFinite(litros) && litros > 0;

  const onSubmit = (values: CargaFormValues) => {
    if (!photoFlow.file) return;
    // La foto viaja con el registro y se sube al sincronizar.
    crear.mutate(
      {
        input: { equipoId, litros: values.litros, tipo: values.tipo, fecha: new Date(values.fecha).toISOString() },
        foto: photoFlow.file,
      },
      { onSuccess: cerrar },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable={!crear.isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={crear.isPending} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Registrar carga{equipoLabel ? ` · ${equipoLabel}` : ''}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4"
              id="registrar-carga-form"
              noValidate
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              <FotoRespaldoField
                captureDate={photoFlow.captureDate}
                fechaEditable
                file={photoFlow.file}
                isReadingPhoto={photoFlow.isReadingPhoto}
                onClear={quitarFoto}
                onSelect={(f) => void photoFlow.handleSelectPhoto(f)}
                staleQuestion="¿es la carga actual?"
                subtitle="Debe verse el totalizador del surtidor"
                title="Fotografiar el surtidor"
              />

              <Controller
                control={control}
                name="litros"
                render={({ field }) => (
                  <DecimalField
                    decimales={3}
                    errorMessage={errors.litros?.message ?? revisionLitros.error ?? undefined}
                    isDisabled={!photoFlow.file}
                    isInvalid={!!errors.litros || revisionLitros.error != null}
                    label="Litros"
                    litros
                    warning={revisionLitros.aviso ?? undefined}
                    labelAddon={ocrLeido ? <OcrLitrosChip litros={litros} ocr={ocrLeido} /> : undefined}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    placeholder={!photoFlow.file ? 'Requiere foto de respaldo' : undefined}
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
                    isInvalid={!!errors.fecha}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    type="datetime-local"
                    value={field.value}
                  >
                    <Label>Fecha de carga</Label>
                    <Input />
                    {errors.fecha ? <FieldError>{errors.fecha.message}</FieldError> : null}
                  </TextField>
                )}
              />
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={crear.isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button form="registrar-carga-form" isDisabled={!puedeGuardar} isPending={crear.isPending} type="submit">
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar carga')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
