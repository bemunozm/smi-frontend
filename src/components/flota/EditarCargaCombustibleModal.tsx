import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField } from '@heroui/react';

import { DecimalField } from '../DecimalField';
import { useEditarCargaCombustible } from '../../hooks/useCombustible';
import type { UpdateCombustibleBody } from '../../api/CombustibleAPI';
import { fechaRegistroIso, toDateTimeLocal } from '../../lib/format';
import type { RegistroCombustible } from '../../types/combustible';
import { RESPONSIVE_SHEET_DIALOG_CLASS } from './modal-styles';

const TIPO_OPTIONS = [
  { value: 'PETROLEO', label: 'Petróleo' },
  { value: 'BENCINA', label: 'Bencina' },
] as const;

/** Tope espejo del backend (`FUEL_LITERS_MAX`): el caso que esta edición
 * corrige es justamente un «100.000» del display leído como cien mil litros. */
const LITROS_MAX = 100_000;

const EdicionSchema = z.object({
  litros: z
    .number()
    .positive('Litros debe ser mayor a 0')
    .max(LITROS_MAX, 'Revisa los litros: no puede superar 100.000 L'),
  lectura: z.number().positive('Ingresá la lectura del contador'),
  tipo: z.enum(['PETROLEO', 'BENCINA']),
  fecha: z.string().min(1, 'Requerido'),
});
type EdicionValues = z.infer<typeof EdicionSchema>;

/**
 * Corrección de una carga desde el panel (solo ADMIN — el botón ya viene
 * filtrado por `canEditCombustible`). Una carga MANUAL edita litros, tipo,
 * fecha y lectura; una nacida del cierre de una TARJETA solo los litros — la
 * corrección edita la tarjeta vinculada (queda en su historial) y el backend
 * sincroniza esta carga. La foto nunca se edita: es la evidencia.
 */
export function EditarCargaCombustibleModal({ carga, onClose }: { carga: RegistroCombustible; onClose: () => void }) {
  const editar = useEditarCargaCombustible();
  const esDeTarjeta = Boolean(carga.registroHorometroId);
  const esLiviano = carga.equipo?.equipmentClass === 'LIGHT';

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EdicionValues>({
    resolver: zodResolver(EdicionSchema),
    defaultValues: {
      litros: carga.litros,
      lectura: carga.lectura ?? 0,
      tipo: carga.tipo === 'BENCINA' ? 'BENCINA' : 'PETROLEO',
      fecha: toDateTimeLocal(new Date(carga.fecha)),
    },
  });

  const litros = watch('litros');
  const lectura = watch('lectura');
  const fechaIso = fechaRegistroIso(watch('fecha'));
  const puedeGuardar =
    !editar.isPending &&
    Number.isFinite(litros) &&
    litros > 0 &&
    litros <= LITROS_MAX &&
    (esDeTarjeta || (fechaIso !== null && Number.isFinite(lectura) && lectura > 0));

  const onSubmit = (values: EdicionValues) => {
    let cambios: UpdateCombustibleBody;
    if (esDeTarjeta) {
      // Solo litros — y si no cambiaron, no hay nada que mandar.
      if (values.litros === carga.litros) {
        onClose();
        return;
      }
      cambios = { litros: values.litros };
    } else {
      const iso = fechaRegistroIso(values.fecha);
      if (!iso) return;
      cambios = {
        ...(values.litros !== carga.litros ? { litros: values.litros } : {}),
        ...(values.tipo !== carga.tipo ? { tipo: values.tipo } : {}),
        ...(iso !== new Date(carga.fecha).toISOString() ? { fecha: iso } : {}),
        ...(values.lectura !== (carga.lectura ?? 0) ? { lectura: values.lectura } : {}),
      };
      if (Object.keys(cambios).length === 0) {
        onClose();
        return;
      }
    }
    editar.mutate({ carga, cambios }, { onSuccess: onClose });
  };

  return (
    <Modal.Backdrop
      isDismissable={!editar.isPending}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_CLASS}>
          <Modal.CloseTrigger isDisabled={editar.isPending} />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {`Editar carga · ${carga.equipo?.internalCode ?? '—'}`}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4"
              id="editar-carga-form"
              noValidate
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            >
              {esDeTarjeta && (
                <p className="m-0 rounded-2xl bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning-soft-foreground">
                  Esta carga nació del <b>cierre de una tarjeta de turno</b>: la corrección edita esa tarjeta (queda en
                  su historial) y acá solo se corrigen los litros.
                </p>
              )}

              <Controller
                control={control}
                name="litros"
                render={({ field }) => (
                  <DecimalField
                    errorMessage={errors.litros?.message}
                    isInvalid={!!errors.litros}
                    label="Litros"
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    value={field.value}
                  />
                )}
              />

              {!esDeTarjeta && (
                <>
                  <Controller
                    control={control}
                    name="lectura"
                    render={({ field }) => (
                      <DecimalField
                        errorMessage={errors.lectura?.message}
                        isInvalid={!!errors.lectura}
                        label={esLiviano ? 'Kilometraje al cargar (km)' : 'Horómetro al cargar (h)'}
                        // El contador del equipo solo AVANZA con una lectura
                        // mayor: si quedó inflado por el typo, se corrige en la
                        // ficha del equipo.
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
                </>
              )}
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={editar.isPending} onPress={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button form="editar-carga-form" isDisabled={!puedeGuardar} isPending={editar.isPending} type="submit">
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar cambios')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
