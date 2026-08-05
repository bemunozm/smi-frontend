import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { hallazgoFormSchema, type HallazgoForm } from './schema';
import { useHallazgosList, useCreateHallazgo } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { fmtDate, fmtTime } from '../../../shared/lib/format';
import {
  Card,
  Chip,
  FieldLabel,
  ListCard,
  PhotoButtons,
  PrimaryButton,
  SectionHeader,
  Segmented,
  SelectField,
  TextareaField,
  type ChipTone,
} from '../../../shared/ui/mobile';

const CRIT_ITEMS = [
  { value: 'BAJA' as const, label: 'BAJA' },
  { value: 'MEDIA' as const, label: 'MEDIA' },
  { value: 'ALTA' as const, label: 'ALTA' },
  { value: 'CRITICA' as const, label: 'CRÍTICA' },
];

const critTone: Record<string, ChipTone> = {
  BAJA: 'neutral',
  MEDIA: 'warning',
  ALTA: 'danger',
  CRITICA: 'danger-solid',
};
const critAccent: Record<string, string> = {
  BAJA: '#928d80',
  MEDIA: '#c87f0a',
  ALTA: '#a31e22',
  CRITICA: '#a31e22',
};
const critLabel: Record<string, string> = { BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'ALTA', CRITICA: 'CRÍTICA' };

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

export function HallazgosPage() {
  const { data: equipos = [] } = useEquipos();
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
    defaultValues: { equipoId: '', descripcion: '', criticidad: 'MEDIA' },
  });

  const criticidad = (watch('criticidad') as HallazgoForm['criticidad']) ?? 'MEDIA';
  const fotoUrl = watch('fotoUrl');

  const onSubmit = (values: HallazgoForm) =>
    crear.mutate(values, {
      onSuccess: () => reset({ equipoId: '', descripcion: '', criticidad: 'MEDIA', fotoUrl: undefined }),
    });

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          <SelectField label="Equipo" error={errors.equipoId?.message} {...register('equipoId')}>
            <option value="">Seleccioná…</option>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo} — {e.tipo}
              </option>
            ))}
          </SelectField>

          <div>
            <FieldLabel>Criticidad</FieldLabel>
            <Segmented value={criticidad} onChange={(v) => setValue('criticidad', v)} options={CRIT_ITEMS} />
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

      <SectionHeader action="Ver todos">Hallazgos del turno</SectionHeader>
      <div className="space-y-2.5">
        {hallazgos.map((h) => (
          <ListCard key={h.id} accent={critAccent[h.criticidad]}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{h.equipo?.codigo ?? h.equipoId}</span>
              <Chip tone={critTone[h.criticidad] ?? 'neutral'}>{critLabel[h.criticidad] ?? h.criticidad}</Chip>
              <span className="tabular ml-auto text-xs text-muted-foreground">{fmtTime(h.fecha)}</span>
            </div>
            <p className="mt-1.5 text-sm text-foreground">{h.descripcion}</p>
            <div className="mt-2 flex items-center gap-2">
              <Chip tone={estadoTone[h.estado] ?? 'neutral'}>{estadoLabel[h.estado] ?? h.estado}</Chip>
              <span className="tabular text-xs text-muted-foreground">{fmtDate(h.fecha)}</span>
            </div>
          </ListCard>
        ))}
        {hallazgos.length === 0 && <p className="px-1 text-sm text-muted-foreground">Sin hallazgos del turno.</p>}
      </div>
    </div>
  );
}
