import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Check, CircleCheck, Plus, Trash2 } from 'lucide-react';

import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import {
  Automatico,
  Automaticos,
  Boton,
  Campo,
  Chip,
  ChipEstado,
  Form,
  Input,
  Label,
  ModalTerreno,
  SelectorBuscable,
  Textarea,
  type OpcionSelector,
} from '../terreno/ui';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';
import { useBranches } from '../../hooks/useBranches';
import { useFinishTask } from '../../hooks/useIntervenciones';
import { useItems } from '../../hooks/useInventory';
import { TIPO_OT_LABELS } from '../../config/mantenimiento-colors';
import {
  CreateIntervencionSchema,
  type CreateIntervencionInput,
  type OrdenTrabajo,
} from '../../types/mantenimiento';
import { UNIT_SYMBOLS, quantityAt, type InventoryItem } from '../../types/inventory';
import { equipmentLabel, type EquipmentRef } from './workshop';

/**
 * Pop-up "Finalizar tarea" — kit de Terreno: qué se hizo + foto de respaldo +
 * insumos (SelectorBuscable con grupos y stock en Faena) + horómetro.
 * Registra la intervención y pasa la OT a COMPLETADA (`useFinishTask`, por la
 * cola). La bodega es SIEMPRE la de faena — no hay opción de cambiarla.
 */
export function FinishTaskModal({
  orden,
  equipment,
}: {
  orden: OrdenTrabajo;
  equipment: readonly EquipmentRef[] | undefined;
}) {
  const finishTask = useFinishTask();
  const { data: items } = useItems({ isActive: true });
  const { data: branches } = useBranches({ isActive: true });
  const [abierto, setAbierto] = useState(false);
  // Misma captura de foto que los hallazgos de Terreno (EXIF, sin OCR).
  const foto = usePhotoCaptureFlow(() => {}, { ocr: false });

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateIntervencionInput>({
    resolver: zodResolver(CreateIntervencionSchema),
    defaultValues: {
      tipo: orden.tipo,
      detalle: '',
      // Sin default: un horómetro no tocado NO se envía — mandar 0 inventaría
      // una lectura del medidor que nadie tomó.
      horometro: undefined,
      branchId: undefined,
      insumos: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'insumos' });

  // Regla del taller: los insumos salen SIEMPRE de la bodega de FAENA.
  const faenaBranch = useMemo(
    () => branches?.find((branch) => /faena/i.test(branch.name)),
    [branches],
  );
  useEffect(() => {
    const target = faenaBranch?.id;
    if (target && getValues('branchId') !== target) {
      setValue('branchId', target);
    }
  }, [faenaBranch, getValues, setValue]);

  // Opciones del selector: la distinción de Inventario como grupos, y la
  // existencia en Faena como aviso — sin stock queda apagado con el motivo.
  const opcionesInsumo: OpcionSelector[] = useMemo(() => {
    const opcion = (item: InventoryItem, grupo: string): OpcionSelector => {
      const stock = faenaBranch ? quantityAt(item, faenaBranch.id) : null;
      const sinStock = stock !== null && stock <= 0;
      return {
        valor: item.id,
        titulo: item.sku,
        detalle: item.name,
        grupo,
        ...(sinStock
          ? { motivo: 'Sin stock en Faena' }
          : stock !== null
            ? { aviso: `${stock} ${UNIT_SYMBOLS[item.unit]} en Faena` }
            : {}),
      };
    };
    const lista = items ?? [];
    return [
      ...lista.filter((item) => item.type === 'SUPPLY').map((item) => opcion(item, 'Suministros')),
      ...lista.filter((item) => item.type === 'PART').map((item) => opcion(item, 'Repuestos')),
    ];
  }, [items, faenaBranch]);

  const cerrar = () => setAbierto(false);

  const onSubmit = (values: CreateIntervencionInput): void => {
    finishTask.mutate(
      { orden, intervencion: values, foto: foto.file },
      {
        onSuccess: () => {
          reset();
          foto.handleClearPhoto();
          cerrar();
        },
      },
    );
  };

  return (
    <>
      <Boton ancho variante="acento" onClick={() => setAbierto(true)}>
        <Check className="h-5 w-5" />
        Finalizar tarea
      </Boton>
      <ModalTerreno
        abierto={abierto}
        detalle="Registra qué hiciste y qué utilizaste para cerrar la operación."
        titulo="Finalizar tarea"
        onAbiertoChange={setAbierto}
      >
        <form
          className="flex flex-col gap-3.5"
          id={`finish-task-${orden.id}`}
          noValidate
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        >
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-[#fafbfc] px-3.5 py-3">
            <Chip tono={orden.tipo === 'PREVENTIVA' ? 'info' : 'neutral'}>
              {TIPO_OT_LABELS[orden.tipo]}
            </Chip>
            <span className="tabular text-xs text-muted-foreground">
              {equipmentLabel(orden.equipoId, equipment)}
            </span>
            <strong className="min-w-0 flex-1 truncate text-sm">{orden.titulo}</strong>
            <ChipEstado color="#1a3a9c">En proceso</ChipEstado>
          </div>

          <Form>
            <Controller
              control={control}
              name="detalle"
              render={({ field }) => (
                <Campo error={errors.detalle?.message} label="¿Qué se hizo?" requerido>
                  <Textarea
                    name={field.name}
                    placeholder="Describe el trabajo realizado..."
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                  />
                </Campo>
              )}
            />

            <FotoRespaldoField
              captureDate={foto.captureDate}
              file={foto.file}
              guia="Encuadra el trabajo terminado o los insumos ocupados, con luz."
              isReadingPhoto={foto.isReadingPhoto}
              requerida={false}
              staleQuestion="¿Es la foto del trabajo recién terminado?"
              subtitle="Respalda el trabajo o los insumos ocupados."
              title="Foto de lo realizado"
              onClear={foto.handleClearPhoto}
              onSelect={(file) => void foto.handleSelectPhoto(file)}
            />

            <div className="flex items-center justify-between gap-2">
              <Label>¿Qué se utilizó?</Label>
              <Boton
                className="min-h-[44px] px-4 text-sm"
                type="button"
                variante="contorno"
                onClick={() => append({ insumoId: '', cantidad: 1 })}
              >
                <Plus className="h-4 w-4" />
                Agregar insumo
              </Boton>
            </div>

            {fields.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                Sin insumos registrados en esta operación.
              </p>
            ) : (
              <>
                {faenaBranch ? (
                  <Automaticos>
                    <Automatico label="Bodega" nota="Fija del taller" valor={faenaBranch.name} />
                  </Automaticos>
                ) : (
                  <div
                    className="rounded-2xl bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-[var(--danger-soft-foreground)]"
                    role="alert"
                  >
                    No hay una bodega de faena activa en Inventario — no se puede descontar stock.
                    Crea o reactiva la bodega "Faena" antes de cerrar con insumos.
                  </div>
                )}

                {fields.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_6.5rem_52px] items-end gap-2.5 rounded-2xl border border-border bg-[#fafbfc] p-3"
                  >
                    <Controller
                      control={control}
                      name={`insumos.${index}.insumoId`}
                      render={({ field }) => (
                        <Campo error={errors.insumos?.[index]?.insumoId?.message} label="Insumo">
                          <SelectorBuscable
                            etiqueta="Insumo"
                            opciones={opcionesInsumo}
                            placeholder="Busca por código o nombre…"
                            tituloTabular
                            valor={field.value ?? ''}
                            onChange={field.onChange}
                          />
                        </Campo>
                      )}
                    />
                    <Controller
                      control={control}
                      name={`insumos.${index}.cantidad`}
                      render={({ field }) => (
                        <Campo error={errors.insumos?.[index]?.cantidad?.message} label="Cantidad">
                          <Input
                            entero
                            value={
                              field.value === undefined || Number.isNaN(field.value)
                                ? ''
                                : String(field.value)
                            }
                            onBlur={field.onBlur}
                            onChange={(e) => {
                              const texto = e.target.value;
                              field.onChange(texto === '' ? undefined : Number(texto));
                            }}
                          />
                        </Campo>
                      )}
                    />
                    <Boton
                      aria-label="Quitar insumo"
                      className="h-[52px] w-[52px] min-h-0 px-0"
                      type="button"
                      variante="contorno"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Boton>
                  </div>
                ))}
              </>
            )}

            <Controller
              control={control}
              name="horometro"
              render={({ field }) => (
                <Campo
                  error={errors.horometro?.message}
                  hint="Opcional — la lectura del medidor al cerrar."
                  label="Horómetro de cierre"
                  unidad="h"
                >
                  <Input
                    numerico
                    value={
                      field.value === undefined || Number.isNaN(field.value)
                        ? ''
                        : String(field.value)
                    }
                    onBlur={field.onBlur}
                    onChange={(e) => {
                      const texto = e.target.value.replace(',', '.');
                      field.onChange(texto === '' ? undefined : Number(texto));
                    }}
                  />
                </Campo>
              )}
            />
          </Form>

          <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--success-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--success-soft-foreground)]">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Al guardar <strong>se descuenta el stock</strong> de la bodega elegida (movimientos
              trazables en Inventario) y la operación pasa a <strong>Finalizado</strong>, en solo
              lectura. Si un insumo no alcanza, no se guarda nada.
            </span>
          </div>

          <div className="mt-1 flex gap-2.5">
            <Boton ancho type="button" variante="contorno" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton ancho disabled={finishTask.isPending} type="submit" variante="acento">
              {finishTask.isPending ? 'Guardando…' : 'Guardar y finalizar'}
            </Boton>
          </div>
        </form>
      </ModalTerreno>
    </>
  );
}
