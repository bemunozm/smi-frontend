import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { hallazgoFormSchema, type HallazgoForm } from '../types/hallazgos';
import { useHallazgosList, useCreateHallazgo } from '../hooks/useHallazgos';
import { useEquipment } from '../hooks/useEquipment';
import { fmtDate, fmtTime } from '../lib/format';
import {
  Card,
  Chip,
  FieldLabel,
  ListCard,
  PhotoButtons,
  PrimaryButton,
  Segmented,
  SelectField,
  TextareaField,
  type ChipTone,
} from '../components/terreno/mobile';
import { COLUMNA, Historial, Tabla, VistaTerreno } from '../components/terreno/historial';
import { Table } from '@heroui/react';

const PRIORIDAD_ITEMS = [
  { value: 'BAJA' as const, label: 'BAJA' },
  { value: 'MEDIA' as const, label: 'MEDIA' },
  { value: 'ALTA' as const, label: 'ALTA' },
  { value: 'CRITICA' as const, label: 'CRÍTICA' },
];

const prioridadTone: Record<string, ChipTone> = {
  BAJA: 'neutral',
  MEDIA: 'warning',
  ALTA: 'danger',
  CRITICA: 'danger-solid',
};
const prioridadAccent: Record<string, string> = {
  BAJA: '#928d80',
  MEDIA: '#c87f0a',
  ALTA: '#a31e22',
  CRITICA: '#a31e22',
};
const prioridadLabel: Record<string, string> = { BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'ALTA', CRITICA: 'CRÍTICA' };

const estadoTone: Record<string, ChipTone> = {
  ABIERTO: 'danger',
  EN_PROCESO: 'info',
  CERRADO: 'success',
};
const estadoLabel: Record<string, string> = {
  ABIERTO: 'ABIERTO',
  EN_PROCESO: 'EN PROCESO',
  CERRADO: 'CERRADO',
};

export function HallazgosView() {
  const { data: equipos = [] } = useEquipment();
  const { data: hallazgos = [] } = useHallazgosList();
  const crear = useCreateHallazgo();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HallazgoForm>({
    resolver: zodResolver(hallazgoFormSchema),
    defaultValues: { equipoId: '', descripcion: '', prioridad: 'MEDIA' },
  });

  const prioridad = (watch('prioridad') as HallazgoForm['prioridad']) ?? 'MEDIA';
  const fotoUrl = watch('fotoUrl');

  const onSubmit = (values: HallazgoForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', descripcion: '', prioridad: 'MEDIA', fotoUrl: undefined }),
    });

  const formulario = (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card className="space-y-4">
        <SelectField label="Equipo" error={errors.equipoId?.message} {...register('equipoId')}>
          <option value="">Seleccioná…</option>
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.internalCode} — {e.type}
            </option>
          ))}
        </SelectField>

        <div>
          <FieldLabel>Nivel de prioridad</FieldLabel>
          <Segmented value={prioridad} onChange={(v) => setValue('prioridad', v)} options={PRIORIDAD_ITEMS} />
        </div>

        <TextareaField
          label="Descripción"
          rows={3}
          placeholder="Qué se detectó, dónde y en qué condición"
          error={errors.descripcion?.message}
          {...register('descripcion')}
        />

        <div>
          <FieldLabel hint={<span className="text-muted-foreground">Opcional</span>}>Foto</FieldLabel>
          <PhotoButtons value={fotoUrl} onChange={(u) => setValue('fotoUrl', u)} />
        </div>

        <PrimaryButton type="submit" disabled={crear.isPending}>
          {crear.isPending ? 'Guardando…' : 'Registrar hallazgo'}
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </Card>
    </form>
  );

  return (
    <VistaTerreno
      formulario={formulario}
      historial={
        <Historial
          titulo="Hallazgos del turno"
          vacio="Sin hallazgos del turno."
          hayRegistros={hallazgos.length > 0}
          tarjetas={() =>
            hallazgos.map((h) => (
              <ListCard key={h.id} accent={prioridadAccent[h.prioridad]}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{h.equipo?.internalCode ?? h.equipoId}</span>
                  <Chip tone={prioridadTone[h.prioridad] ?? 'neutral'}>
                    {prioridadLabel[h.prioridad] ?? h.prioridad}
                  </Chip>
                  <span className="tabular ml-auto text-xs text-muted-foreground">{fmtTime(h.fecha)}</span>
                </div>
                <p className="mt-1.5 text-sm text-foreground">{h.descripcion}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Chip tone={estadoTone[h.estado] ?? 'neutral'}>{estadoLabel[h.estado] ?? h.estado}</Chip>
                  <span className="tabular text-xs text-muted-foreground">{fmtDate(h.fecha)}</span>
                </div>
              </ListCard>
            ))
          }
          tabla={() => (
            <Tabla label="Hallazgos del turno">
              <Table.Header>
                <Table.Column className={COLUMNA} isRowHeader>
                  Equipo
                </Table.Column>
                <Table.Column className={COLUMNA}>Prioridad</Table.Column>
                <Table.Column className={COLUMNA}>Descripción</Table.Column>
                <Table.Column className={COLUMNA}>Estado</Table.Column>
                <Table.Column className={COLUMNA}>Fecha</Table.Column>
              </Table.Header>
              <Table.Body>
                {hallazgos.map((h) => (
                  <Table.Row key={h.id}>
                    <Table.Cell className="font-semibold text-foreground">
                      {h.equipo?.internalCode ?? h.equipoId}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip tone={prioridadTone[h.prioridad] ?? 'neutral'}>
                        {prioridadLabel[h.prioridad] ?? h.prioridad}
                      </Chip>
                    </Table.Cell>
                    {/* La descripción es el texto largo de la fila: se lleva el
                        ancho sobrante y el resto de las columnas no se deforma. */}
                    <Table.Cell className="w-full max-w-0 truncate text-sm text-foreground">
                      {h.descripcion}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip tone={estadoTone[h.estado] ?? 'neutral'}>{estadoLabel[h.estado] ?? h.estado}</Chip>
                    </Table.Cell>
                    <Table.Cell className="tabular text-sm whitespace-nowrap text-muted-foreground">
                      {fmtDate(h.fecha)} · {fmtTime(h.fecha)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Tabla>
          )}
        />
      }
    />
  );
}
