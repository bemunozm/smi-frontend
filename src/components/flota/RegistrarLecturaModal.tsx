import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';

import { useCreateHorometro } from '../../hooks/useHorometro';
import type { HorometroForm } from '../../types/horometro';
import { uploadImage } from '../../api/UploadsAPI';
import { fmtDate, fmtTime } from '../../lib/format';
import { formatRelative, isFresh, readCaptureDate, recognizeReading, type OcrResult } from '../../lib/photo-reading';
import { PhotoCaptureField } from './PhotoCaptureField';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const TURNO_OPTIONS = [
  { value: 'DIURNO', label: 'Diurno' },
  { value: 'NOCTURNO', label: 'Nocturno' },
] as const;

// Schema local de la UI (no el `horometroFormSchema` de Terreno): acá los
// campos numéricos son controlados por `NumberField` (necesita `number`, no
// el `number | undefined` de los helpers `optNumber`/`nonNegNumber` pensados
// para inputs nativos registrados con `valueAsNumber`). El payload final que
// se envía a `useCreateHorometro` sí respeta el tipo `HorometroForm` real.
const LecturaSchema = z.object({
  operador: z.string().min(1, 'Indicá el operador'),
  turno: z.enum(['DIURNO', 'NOCTURNO']),
  valorInicial: z.number().nonnegative('Valor inválido'),
  // Opcional de verdad: el `NumberField` necesita partir en 0 para quedar
  // controlado, pero eso es solo el valor de PANTALLA — `nivelTouched` (más
  // abajo) es lo que decide si 0 fue realmente ingresado por el usuario o si
  // nunca tocó el campo, así el payload no manda un 0% falso.
  nivelCombustible: z.number().min(0, 'Valor inválido').max(100, 'Máximo 100%').optional(),
});
type LecturaFormValues = z.infer<typeof LecturaSchema>;

const DEFAULT_VALUES: LecturaFormValues = {
  operador: '',
  turno: 'DIURNO',
  valorInicial: 0,
  nivelCombustible: 0,
};

interface RegistrarLecturaModalProps {
  equipoId: string;
  /** Código interno del equipo, solo para el título del modal. */
  equipoLabel?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Registro de lectura de horómetro con trazabilidad anti-falsificación: la
 * foto es obligatoria, de ella se autorrellena la lectura por OCR (editable),
 * se valida la fecha real de captura vía EXIF y la foto en sí se sube y queda
 * archivada en el registro (`fotoUrl` — ver `types/horometro.ts`), mismo
 * patrón que `RegistrarCargaCombustibleModal`.
 */
export function RegistrarLecturaModal({ equipoId, equipoLabel, isOpen, onOpenChange }: RegistrarLecturaModalProps) {
  const crear = useCreateHorometro();

  const [file, setFile] = useState<File | null>(null);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [captureDate, setCaptureDate] = useState<Date | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  // El usuario tocó el stepper de nivel de combustible (distinto de "vale 0"
  // por defecto) — ver el comentario en `LecturaSchema.nivelCombustible`.
  const [nivelTouched, setNivelTouched] = useState(false);
  // Se marca en `cerrar()` y se revisa después del `await uploadImage(...)`:
  // la subida de la foto no es cancelable (es una promesa ya en vuelo), así
  // que si el usuario cierra/cancela MIENTRAS sube, esto evita que igual se
  // cree la lectura cuando la subida termine (mismo patrón que combustible).
  const canceladoRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LecturaFormValues>({
    resolver: zodResolver(LecturaSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const limpiarTodo = () => {
    reset(DEFAULT_VALUES);
    setFile(null);
    setCaptureDate(null);
    setOcr(null);
    setIsReadingPhoto(false);
    setIsUploadingPhoto(false);
    setNivelTouched(false);
  };

  // Único punto de cierre: tanto "Cancelar" como el backdrop/ESC/botón X
  // pasan por acá. Si no se limpia el estado, el modal queda MONTADO y se
  // reutiliza para el próximo equipo que se abra (misma instancia en
  // `EquipoDetalleView`) — sin este reset, la foto/OCR/lectura de un equipo
  // se filtraría al abrir el modal para otro `equipoId`. También es el
  // gatillo que aborta un `onSubmit` en vuelo (ver `canceladoRef`).
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
        setValue('valorInicial', Number(lectura.value), { shouldValidate: true });
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

  const operador = watch('operador');
  const valorInicial = watch('valorInicial');
  const puedeGuardar =
    !!file &&
    !isReadingPhoto &&
    !isUploadingPhoto &&
    !crear.isPending &&
    operador.trim().length > 0 &&
    Number.isFinite(valorInicial) &&
    valorInicial >= 0;

  const onSubmit = async (values: LecturaFormValues) => {
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
    // abortar (ya estaba en vuelo), pero al menos evitamos crear la lectura
    // después de que cerró el modal.
    if (canceladoRef.current) return;

    const payload: HorometroForm = {
      equipoId,
      operador: values.operador.trim(),
      turno: values.turno,
      valorInicial: values.valorInicial,
      valorFinal: undefined,
      // Solo se manda si el usuario efectivamente tocó el campo — de lo
      // contrario el 0 de pantalla se guardaría como un nivel real y
      // enmascararía el "último nivel" verdadero en la ficha.
      nivelCombustible: nivelTouched ? values.nivelCombustible : undefined,
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
              Registrar lectura{equipoLabel ? ` · ${equipoLabel}` : ''}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4"
              id="registrar-lectura-form"
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
                  subtitle="Debe verse el marcador completo"
                  title="Fotografiar el horómetro"
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
                      {isFresh(captureDate) ? ' · reciente' : ' · ¿es la lectura actual?'}
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
                name="valorInicial"
                render={({ field }) => (
                  <NumberField
                    fullWidth
                    isDisabled={!file}
                    isInvalid={!!errors.valorInicial}
                    minValue={0}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Label>Lectura de horómetro (h)</Label>
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
                    {errors.valorInicial ? <FieldError>{errors.valorInicial.message}</FieldError> : null}
                  </NumberField>
                )}
              />

              <Controller
                control={control}
                name="operador"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={!!errors.operador}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <Label>Operador</Label>
                    <Input placeholder="Nombre y apellido" />
                    {errors.operador ? <FieldError>{errors.operador.message}</FieldError> : null}
                  </TextField>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="turno"
                  render={({ field }) => (
                    <Select
                      fullWidth
                      name={field.name}
                      value={field.value}
                      onChange={(value) => {
                        if (value) field.onChange(value);
                      }}
                    >
                      <Label>Turno</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {TURNO_OPTIONS.map((option) => (
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
                  name="nivelCombustible"
                  render={({ field }) => (
                    <NumberField
                      fullWidth
                      isInvalid={!!errors.nivelCombustible}
                      maxValue={100}
                      minValue={0}
                      onChange={(value) => {
                        field.onChange(value);
                        setNivelTouched(true);
                      }}
                      value={field.value}
                    >
                      <Label>Nivel de combustible (%, opcional)</Label>
                      <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input onBlur={field.onBlur} />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                      {errors.nivelCombustible ? <FieldError>{errors.nivelCombustible.message}</FieldError> : null}
                    </NumberField>
                  )}
                />
              </div>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={isUploadingPhoto || crear.isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button
              form="registrar-lectura-form"
              isDisabled={!puedeGuardar}
              isPending={crear.isPending || isUploadingPhoto}
              type="submit"
            >
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar lectura')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
