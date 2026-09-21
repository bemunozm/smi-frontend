import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Chip, FieldError, Label, Modal, NumberField, Spinner } from '@heroui/react';

import { useCerrarHorometro } from '../../hooks/useHorometro';
import type { CerrarHorometroInput } from '../../types/horometro';
import type { ControlUnit, OpenShift } from '../../types/equipment';
import { controlUnitSuffix, turnoLabel } from '../../config/flota-colors';
import { fmtDate, fmtTime } from '../../lib/format';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

/** Label del campo de lectura, dinámico según la unidad de control del
 * equipo — mismo criterio que `RegistrarEntradaModal`. */
const VALOR_FINAL_LABEL: Record<ControlUnit, string> = {
  HOURS: 'Horómetro total al terminar (h)',
  KM: 'Odómetro total al terminar (km)',
};

// Schema local de la UI — ver la nota equivalente en `RegistrarEntradaModal`
// sobre por qué no se reutiliza un schema de `types/` tal cual (el
// `NumberField` necesita `number`, no `number | undefined`). La validación
// cruzada contra `openShift.valorInicial` (el backend rechaza con 400 si
// `valorFinal < valorInicial`) no puede vivir en ESTE schema porque
// `valorInicial` no es un campo del form — se hace a mano en `puedeGuardar`
// y en el mensaje de error de abajo, replicando la regla de negocio del
// backend para feedback inmediato (el backend sigue siendo el guardián real).
const SalidaSchema = z.object({
  valorFinal: z.number().nonnegative('Valor inválido'),
  nivelCombustible: z.number().min(0, 'Valor inválido').max(100, 'Máximo 100%').optional(),
});
type SalidaFormValues = z.infer<typeof SalidaSchema>;

const DEFAULT_VALUES: SalidaFormValues = { valorFinal: 0, nivelCombustible: 0 };

interface RegistrarSalidaModalProps {
  /** Código interno del equipo, solo para el título del modal. */
  equipoLabel?: string;
  controlUnit: ControlUnit;
  /** Turno abierto que se está cerrando (`equipo.openShift`) — el llamador
   * solo debe montar este modal cuando existe (ver `EquipoDetalleView`/
   * `EquiposView`, que alternan entre este modal y `RegistrarEntradaModal`
   * según `equipo.openShift`). */
  openShift: OpenShift;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * SALIDA del flujo de horómetro en dos pasos (Flota): cierra el turno
 * abierto por `RegistrarEntradaModal` con la lectura final cargada a mano
 * (sin foto ni OCR/EXIF — mismo criterio que la entrada). Muestra el
 * contexto de la entrada (operador, turno, lectura inicial, hora) y un
 * preview en vivo del uso del turno (`valorFinal − valorInicial`). El
 * backend rechaza con 404 (el turno ya no existe), 409 (ya está cerrado) o
 * 400 (`valorFinal` menor que `valorInicial`) — los tres llegan tal cual vía
 * el toast de error de `useCerrarHorometro`.
 */
export function RegistrarSalidaModal({
  equipoLabel,
  controlUnit,
  openShift,
  isOpen,
  onOpenChange,
}: RegistrarSalidaModalProps) {
  const cerrarTurno = useCerrarHorometro();
  const unitSuffix = controlUnitSuffix(controlUnit);

  // Ver el comentario equivalente en `RegistrarEntradaModal`.
  const [nivelTouched, setNivelTouched] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SalidaFormValues>({
    resolver: zodResolver(SalidaSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const limpiarTodo = () => {
    reset(DEFAULT_VALUES);
    setNivelTouched(false);
  };

  // Único punto de cierre — mismo criterio que `RegistrarEntradaModal`.
  const cerrar = () => {
    limpiarTodo();
    onOpenChange(false);
  };

  const valorFinal = watch('valorFinal');
  const tieneLectura = Number.isFinite(valorFinal);
  const usoValido = tieneLectura && valorFinal >= openShift.valorInicial;
  const uso = tieneLectura ? valorFinal - openShift.valorInicial : null;

  const puedeGuardar = !cerrarTurno.isPending && tieneLectura && usoValido;

  const onSubmit = (values: SalidaFormValues) => {
    const payload: CerrarHorometroInput = {
      valorFinal: values.valorFinal,
      nivelCombustible: nivelTouched ? values.nivelCombustible : undefined,
    };
    cerrarTurno.mutate({ id: openShift.id, payload }, { onSuccess: cerrar });
  };

  return (
    <Modal.Backdrop
      isDismissable={!cerrarTurno.isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={cerrarTurno.isPending} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Registrar salida{equipoLabel ? ` · ${equipoLabel}` : ''}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4"
              id="registrar-salida-form"
              noValidate
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              {/* Contexto del turno que se está cerrando — operador, turno,
                 lectura inicial y hora de entrada (requerimiento del flujo
                 de dos pasos: el usuario tiene que ver esto sin adivinar). */}
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-secondary px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold tracking-wider text-(--muted) uppercase">
                    Turno abierto
                  </span>
                  <Chip color="accent" size="sm" variant="soft">
                    {turnoLabel(openShift.turno)}
                  </Chip>
                </div>
                <div className="flex flex-col gap-1 text-sm text-foreground">
                  <span>
                    Operador: <strong className="font-semibold">{openShift.operador}</strong>
                  </span>
                  <span>
                    Lectura inicial:{' '}
                    <strong className="font-mono font-semibold">
                      {NUMERO.format(openShift.valorInicial)} {unitSuffix}
                    </strong>
                  </span>
                  <span className="text-xs text-(--muted)">
                    Entrada: {fmtDate(openShift.fecha)} {fmtTime(openShift.fecha)}
                  </span>
                </div>
              </div>

              <Controller
                control={control}
                name="valorFinal"
                render={({ field }) => (
                  <NumberField
                    fullWidth
                    isInvalid={!!errors.valorFinal || (tieneLectura && !usoValido)}
                    minValue={0}
                    onChange={field.onChange}
                    value={field.value}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Label>{VALOR_FINAL_LABEL[controlUnit]}</Label>
                      {/* Preview en vivo del uso del turno — verde mientras
                         sea válido (≥ lectura inicial), rojo apenas deja de
                         serlo: mismo umbral que valida el backend. */}
                      {uso != null && (
                        <Chip color={usoValido ? 'success' : 'danger'} size="sm" variant="soft">
                          Uso: {usoValido ? NUMERO.format(uso) : '—'} {unitSuffix}
                        </Chip>
                      )}
                    </div>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input onBlur={field.onBlur} />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                    {errors.valorFinal ? (
                      <FieldError>{errors.valorFinal.message}</FieldError>
                    ) : tieneLectura && !usoValido ? (
                      <FieldError>
                        La lectura final no puede ser menor que la inicial ({NUMERO.format(openShift.valorInicial)}{' '}
                        {unitSuffix}).
                      </FieldError>
                    ) : null}
                  </NumberField>
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
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={cerrarTurno.isPending} onPress={cerrar} variant="secondary">
              Cancelar
            </Button>
            <Button form="registrar-salida-form" isDisabled={!puedeGuardar} isPending={cerrarTurno.isPending} type="submit">
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Registrar salida')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
