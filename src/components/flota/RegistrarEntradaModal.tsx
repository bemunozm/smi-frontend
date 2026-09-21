import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FieldError, Input, Label, ListBox, Modal, NumberField, Select, Spinner, TextField } from '@heroui/react';

import { useCreateHorometro } from '../../hooks/useHorometro';
import type { HorometroForm } from '../../types/horometro';
import type { ControlUnit } from '../../types/equipment';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const TURNO_OPTIONS = [
  { value: 'DIURNO', label: 'Diurno' },
  { value: 'NOCTURNO', label: 'Nocturno' },
] as const;

/** Label del campo de lectura, dinámico según la unidad de control del
 * equipo (`ControlUnit`) — HOURS usa horómetro, KM usa odómetro. */
const VALOR_INICIAL_LABEL: Record<ControlUnit, string> = {
  HOURS: 'Horómetro total al iniciar (h)',
  KM: 'Odómetro total al iniciar (km)',
};

// Schema local de la UI (no el `horometroFormSchema` de Terreno): acá los
// campos numéricos son controlados por `NumberField` (necesita `number`, no
// el `number | undefined` de los helpers `optNumber`/`nonNegNumber` pensados
// para inputs nativos registrados con `valueAsNumber`). El payload final que
// se envía a `useCreateHorometro` sí respeta el tipo `HorometroForm` real.
const EntradaSchema = z.object({
  operador: z.string().min(1, 'Indicá el operador'),
  turno: z.enum(['DIURNO', 'NOCTURNO']),
  valorInicial: z.number().nonnegative('Valor inválido'),
  // Opcional de verdad: el `NumberField` necesita partir en 0 para quedar
  // controlado, pero eso es solo el valor de PANTALLA — `nivelTouched` (más
  // abajo) es lo que decide si 0 fue realmente ingresado por el usuario o si
  // nunca tocó el campo, así el payload no manda un 0% falso.
  nivelCombustible: z.number().min(0, 'Valor inválido').max(100, 'Máximo 100%').optional(),
});
type EntradaFormValues = z.infer<typeof EntradaSchema>;

const DEFAULT_VALUES: EntradaFormValues = {
  operador: '',
  turno: 'DIURNO',
  valorInicial: 0,
  nivelCombustible: 0,
};

interface RegistrarEntradaModalProps {
  equipoId: string;
  /** Código interno del equipo, solo para el título del modal. */
  equipoLabel?: string;
  controlUnit: ControlUnit;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * ENTRADA del flujo de horómetro en dos pasos (Flota): abre un turno con la
 * lectura inicial cargada a mano. El cliente decidió que este flujo queda
 * SIN foto ni OCR/EXIF — a diferencia de `RegistrarCargaCombustibleModal`,
 * que sí los conserva. Antes "Registrar lectura" (un solo paso que nunca
 * mandaba `valorFinal` y por eso no cuadraba el horómetro general del
 * equipo — ver el plan de la Fase de dos pasos); ahora es explícitamente el
 * paso de ENTRADA: el backend rechaza (400) abrir un segundo turno si el
 * equipo ya tiene uno en curso (`equipo.openShift`), y ese mensaje llega tal
 * cual vía el toast de error de `useCreateHorometro`.
 */
export function RegistrarEntradaModal({
  equipoId,
  equipoLabel,
  controlUnit,
  isOpen,
  onOpenChange,
}: RegistrarEntradaModalProps) {
  const crear = useCreateHorometro();

  // El usuario tocó el stepper de nivel de combustible (distinto de "vale 0"
  // por defecto) — ver el comentario en `EntradaSchema.nivelCombustible`.
  const [nivelTouched, setNivelTouched] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EntradaFormValues>({
    resolver: zodResolver(EntradaSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const limpiarTodo = () => {
    reset(DEFAULT_VALUES);
    setNivelTouched(false);
  };

  // Único punto de cierre: tanto "Cancelar" como el backdrop/ESC/botón X
  // pasan por acá. Si no se limpia el estado, el modal queda MONTADO y se
  // reutiliza para el próximo equipo que se abra (misma instancia en
  // `EquipoDetalleView`) — sin este reset, la lectura de un equipo se
  // filtraría al abrir el modal para otro `equipoId`.
  const cerrar = () => {
    limpiarTodo();
    onOpenChange(false);
  };

  const operador = watch('operador');
  const valorInicial = watch('valorInicial');
  const puedeGuardar =
    !crear.isPending && operador.trim().length > 0 && Number.isFinite(valorInicial) && valorInicial >= 0;

  const onSubmit = (values: EntradaFormValues) => {
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
    };
    crear.mutate(payload, { onSuccess: cerrar });
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
              Registrar entrada{equipoLabel ? ` · ${equipoLabel}` : ''}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4"
              id="registrar-entrada-form"
              noValidate
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              <Controller
                control={control}
                name="valorInicial"
                render={({ field }) => (
                  <NumberField
                    fullWidth
                    isInvalid={!!errors.valorInicial}
                    minValue={0}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <Label>{VALOR_INICIAL_LABEL[controlUnit]}</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input onBlur={field.onBlur} />
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
            <Button isDisabled={crear.isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button form="registrar-entrada-form" isDisabled={!puedeGuardar} isPending={crear.isPending} type="submit">
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar entrada')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
