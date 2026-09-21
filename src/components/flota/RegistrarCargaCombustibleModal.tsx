import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Chip, FieldError, Label, ListBox, Modal, NumberField, Select, Spinner } from '@heroui/react';

import { useCreateCombustible } from '../../hooks/useCombustible';
import type { CombustibleForm } from '../../types/combustible';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';
import { FotoRespaldoField } from './FotoRespaldoField';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const TIPO_OPTIONS = [
  { value: 'PETROLEO', label: 'Petróleo' },
  { value: 'BENCINA', label: 'Bencina' },
] as const;

// Schema local de la UI — ver la nota equivalente en `RegistrarEntradaModal`
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

  // Orquestación foto→OCR→EXIF+subida compartida con `RegistrarEntradaModal`/
  // `RegistrarSalidaModal` — ver `usePhotoCaptureFlow`. La lectura sugerida
  // por OCR autorrellena `litros`.
  const photoFlow = usePhotoCaptureFlow((value) => setValue('litros', value, { shouldValidate: true }));

  const limpiarTodo = () => {
    reset(DEFAULT_VALUES);
    photoFlow.resetPhoto();
  };

  // Único punto de cierre: "Cancelar" y el backdrop/ESC/botón X pasan por
  // acá (mismo motivo que en `RegistrarEntradaModal`: sin limpiar, el modal
  // reutilizado filtraría foto/OCR/litros de un equipo a otro). También es
  // el gatillo que aborta un `onSubmit` en vuelo (ver `photoFlow.cancelar`).
  const cerrar = () => {
    photoFlow.cancelar();
    limpiarTodo();
    onOpenChange(false);
  };

  const litros = watch('litros');
  const puedeGuardar =
    !!photoFlow.file &&
    !photoFlow.isReadingPhoto &&
    !photoFlow.isUploadingPhoto &&
    !crear.isPending &&
    Number.isFinite(litros) &&
    litros > 0;

  const onSubmit = async (values: CargaFormValues) => {
    if (!photoFlow.file) return;
    const fotoUrl = await photoFlow.upload(photoFlow.file);
    // `upload` devuelve `null` tanto si la subida falló (ya toasteó el
    // error) como si el flujo se canceló mientras subía — en ambos casos no
    // corresponde crear el registro de combustible.
    if (fotoUrl == null) return;

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
      isDismissable={!photoFlow.isUploadingPhoto && !crear.isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={photoFlow.isUploadingPhoto || crear.isPending} />
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
                file={photoFlow.file}
                isReadingPhoto={photoFlow.isReadingPhoto}
                isUploadingPhoto={photoFlow.isUploadingPhoto}
                onClear={photoFlow.handleClearPhoto}
                onSelect={(f) => void photoFlow.handleSelectPhoto(f)}
                staleQuestion="¿es la carga actual?"
                subtitle="Debe verse el totalizador del surtidor"
                title="Fotografiar el surtidor"
              />

              <Controller
                control={control}
                name="litros"
                render={({ field }) => (
                  <NumberField
                    fullWidth
                    isDisabled={!photoFlow.file}
                    isInvalid={!!errors.litros}
                    minValue={0}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Label>Litros</Label>
                      {photoFlow.ocr?.value && (
                        <Chip color="accent" size="sm" variant="soft">
                          Autorrellenado por OCR · {photoFlow.ocr.confidence}%
                        </Chip>
                      )}
                    </div>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input
                        onBlur={field.onBlur}
                        placeholder={!photoFlow.file ? 'Requiere foto de respaldo' : undefined}
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
            <Button isDisabled={photoFlow.isUploadingPhoto || crear.isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button
              form="registrar-carga-form"
              isDisabled={!puedeGuardar}
              isPending={crear.isPending || photoFlow.isUploadingPhoto}
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
