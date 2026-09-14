import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Chip,
  FieldError,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  Spinner,
  toast,
} from '@heroui/react';

import { useCreateCombustible } from '../../hooks/useCombustible';
import type { CombustibleForm } from '../../types/combustible';
import { uploadImage } from '../../api/UploadsAPI';
import { fmtDate, fmtTime } from '../../lib/format';
import { formatRelative, isFresh, readCaptureDate, recognizeReading, type OcrResult } from '../../lib/photo-reading';
import { PhotoCaptureField } from './PhotoCaptureField';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const TIPO_OPTIONS = [
  { value: 'PETROLEO', label: 'Petróleo' },
  { value: 'BENCINA', label: 'Bencina' },
] as const;

// Schema local de la UI — ver la nota equivalente en `RegistrarLecturaModal`
// sobre por qué no se reutiliza `combustibleFormSchema` tal cual (litros
// controlado por `NumberField` necesita `number`, no `number | undefined`).
const CargaSchema = z.object({
  litros: z.number().positive('Litros debe ser mayor a 0'),
  tipo: z.enum(['PETROLEO', 'BENCINA']),
});
type CargaFormValues = z.infer<typeof CargaSchema>;

const DEFAULT_VALUES: CargaFormValues = { litros: 0, tipo: 'PETROLEO' };

interface RegistrarCargaCombustibleModalProps {
  equipoId: string;
  /** Código interno del equipo, solo para el título del modal. */
  equipoLabel?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Registro de carga de combustible con trazabilidad anti-falsificación: la
 * foto es obligatoria, de ella se autorrellena los litros por OCR (editable)
 * y se valida la fecha real de captura vía EXIF. A diferencia de la lectura
 * de horómetro, acá la foto SÍ se sube y queda archivada (`fotoUrl` existe en
 * `RegistroCombustible` — ver `types/combustible.ts`).
 */
export function RegistrarCargaCombustibleModal({
  equipoId,
  equipoLabel,
  isOpen,
  onOpenChange,
}: RegistrarCargaCombustibleModalProps) {
  const crear = useCreateCombustible();

  const [file, setFile] = useState<File | null>(null);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [captureDate, setCaptureDate] = useState<Date | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  // Se marca en `cerrar()` y se revisa después del `await uploadImage(...)`:
  // la subida de la foto no es cancelable (es una promesa ya en vuelo), así
  // que si el usuario cierra/cancela MIENTRAS sube, esto evita que igual se
  // cree el registro de combustible cuando la subida termine.
  const canceladoRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CargaFormValues>({
    resolver: zodResolver(CargaSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const limpiarTodo = () => {
    reset(DEFAULT_VALUES);
    setFile(null);
    setCaptureDate(null);
    setOcr(null);
    setIsReadingPhoto(false);
    setIsUploadingPhoto(false);
  };

  // Único punto de cierre: "Cancelar" y el backdrop/ESC/botón X pasan por
  // acá (mismo motivo que en `RegistrarLecturaModal`: sin limpiar, el modal
  // reutilizado filtraría foto/OCR/litros de un equipo a otro). También es
  // el gatillo que aborta un `onSubmit` en vuelo (ver `canceladoRef`).
  const cerrar = () => {
    canceladoRef.current = true;
    limpiarTodo();
    onOpenChange(false);
  };

  const handleSelectPhoto = async (selected: File) => {
    setFile(selected);
    setOcr(null);
    setCaptureDate(null);
    setIsReadingPhoto(true);
    try {
      const [fecha, lectura] = await Promise.all([readCaptureDate(selected), recognizeReading(selected)]);
      setCaptureDate(fecha);
      if (lectura.value) {
        setOcr(lectura);
        setValue('litros', Number(lectura.value), { shouldValidate: true });
      }
    } finally {
      setIsReadingPhoto(false);
    }
  };

  const handleClearPhoto = () => {
    setFile(null);
    setCaptureDate(null);
    setOcr(null);
  };

  const litros = watch('litros');
  const puedeGuardar =
    !!file &&
    !isReadingPhoto &&
    !isUploadingPhoto &&
    !crear.isPending &&
    Number.isFinite(litros) &&
    litros > 0;

  const onSubmit = async (values: CargaFormValues) => {
    if (!file) return;
    canceladoRef.current = false;
    setIsUploadingPhoto(true);
    let fotoUrl: string;
    try {
      fotoUrl = await uploadImage(file);
    } catch {
      setIsUploadingPhoto(false);
      if (!canceladoRef.current) toast.danger('No se pudo subir la foto. Intentá de nuevo.');
      return;
    }
    setIsUploadingPhoto(false);

    // El usuario canceló/cerró MIENTRAS la foto subía: la subida no se pudo
    // abortar (ya estaba en vuelo), pero al menos evitamos crear el registro
    // de combustible después de que cerró el modal.
    if (canceladoRef.current) return;

    const payload: CombustibleForm = {
      equipoId,
      litros: values.litros,
      tipo: values.tipo,
      fotoUrl,
    };
    crear.mutate(payload, { onSuccess: cerrar });
  };

  return (
    <Modal.Backdrop
      isDismissable={!isUploadingPhoto && !crear.isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={isUploadingPhoto || crear.isPending} />
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
              <div>
                <p className="mb-1.5 text-[11px] font-bold tracking-wider text-(--muted) uppercase">
                  Foto de respaldo <span className="text-(--danger)">· requerida</span>
                </p>
                <PhotoCaptureField
                  file={file}
                  isBusy={isReadingPhoto || isUploadingPhoto}
                  onClear={handleClearPhoto}
                  onSelect={(f) => void handleSelectPhoto(f)}
                  subtitle="Debe verse el totalizador del surtidor"
                  title="Fotografiar el surtidor"
                />
                {isReadingPhoto && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-(--muted)">
                    <Spinner size="sm" /> Analizando la foto…
                  </p>
                )}
                {!isReadingPhoto && captureDate && (
                  <div
                    className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                      isFresh(captureDate)
                        ? 'bg-(--success-soft) text-(--success-soft-foreground)'
                        : 'bg-(--warning-soft) text-(--warning-soft-foreground)'
                    }`}
                  >
                    {isFresh(captureDate) ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      Foto tomada {formatRelative(captureDate)} ({fmtDate(captureDate.toISOString())}{' '}
                      {fmtTime(captureDate.toISOString())})
                      {isFresh(captureDate) ? ' · reciente' : ' · ¿es la carga actual?'}
                    </span>
                  </div>
                )}
                {!isReadingPhoto && file && !captureDate && (
                  <p className="mt-2 text-xs text-(--muted)">
                    La foto no trae fecha de captura (EXIF) — no se pudo validar su antigüedad.
                  </p>
                )}
              </div>

              <Controller
                control={control}
                name="litros"
                render={({ field }) => (
                  <NumberField
                    fullWidth
                    isDisabled={!file}
                    isInvalid={!!errors.litros}
                    minValue={0}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Label>Litros</Label>
                      {ocr?.value && (
                        <Chip color="accent" size="sm" variant="soft">
                          Autorrellenado por OCR · {ocr.confidence}%
                        </Chip>
                      )}
                    </div>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input
                        onBlur={field.onBlur}
                        placeholder={!file ? 'Requiere foto de respaldo' : undefined}
                      />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                    {errors.litros ? <FieldError>{errors.litros.message}</FieldError> : null}
                  </NumberField>
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
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={isUploadingPhoto || crear.isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button
              form="registrar-carga-form"
              isDisabled={!puedeGuardar}
              isPending={crear.isPending || isUploadingPhoto}
              type="submit"
            >
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar carga')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
