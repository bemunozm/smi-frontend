import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { combustibleFormSchema, type CombustibleForm, type CombustibleFormInput } from './schema';
import { useCombustibleList, useCreateCombustible } from './hooks';
import { useEquipos } from '../../../shared/hooks/useEquipos';
import { assetUrl } from '../../../shared/api/uploads';
import { fmtDate, fmtNum, fmtTime } from '../../../shared/lib/format';
import {
  Card,
  Chip,
  Field,
  FieldLabel,
  ListCard,
  PhotoDropzone,
  PrimaryButton,
  SectionHeader,
  Segmented,
  SelectField,
} from '../../../shared/ui/mobile';

const TIPO_ITEMS = [
  { value: 'PETROLEO' as const, label: 'Petróleo' },
  { value: 'BENCINA' as const, label: 'Bencina' },
];
const tipoLabel: Record<string, string> = { PETROLEO: 'Petróleo', BENCINA: 'Bencina' };

export function CombustiblePage() {
  const { data: equipos = [] } = useEquipos();
  const { data: registros = [] } = useCombustibleList();
  const crear = useCreateCombustible();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CombustibleFormInput, unknown, CombustibleForm>({
    resolver: zodResolver(combustibleFormSchema),
    defaultValues: { equipoId: '', tipo: 'PETROLEO' },
  });

  const tipo = (watch('tipo') as CombustibleForm['tipo']) ?? 'PETROLEO';
  const fotoUrl = watch('fotoUrl');

  const onSubmit = (values: CombustibleForm) =>
    crear.mutate(values, { onSuccess: () => reset({ equipoId: '', tipo: 'PETROLEO', fotoUrl: undefined }) });

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

          <Field
            label="Litros"
            unit="L"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="0"
            error={errors.litros?.message}
            {...register('litros', { valueAsNumber: true })}
          />

          <div>
            <FieldLabel>Tipo de combustible</FieldLabel>
            <Segmented value={tipo} onChange={(v) => setValue('tipo', v)} options={TIPO_ITEMS} />
          </div>

          <div>
            <FieldLabel hint={<span className="text-[var(--danger)]">Requerida</span>}>Foto de la carga</FieldLabel>
            <PhotoDropzone
              value={fotoUrl}
              onChange={(u) => setValue('fotoUrl', u)}
              title="Fotografiar surtidor"
              subtitle="Debe verse el totalizador"
            />
          </div>

          <PrimaryButton type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar carga'}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </Card>
      </form>

      <SectionHeader action="Ver todas">Últimas cargas</SectionHeader>
      <div className="space-y-2.5">
        {registros.map((r) => (
          <ListCard key={r.id}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                {r.fotoUrl ? (
                  <img src={assetUrl(r.fotoUrl)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">{r.equipo?.codigo ?? r.equipoId}</div>
                <div className="tabular text-xs text-muted-foreground">
                  {fmtDate(r.fecha)} · {fmtTime(r.fecha)}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular font-bold text-foreground">{fmtNum(r.litros)} L</div>
                <Chip tone="neutral" className="mt-1">
                  {tipoLabel[r.tipo] ?? r.tipo}
                </Chip>
              </div>
            </div>
          </ListCard>
        ))}
        {registros.length === 0 && <p className="px-1 text-sm text-muted-foreground">Sin cargas registradas.</p>}
      </div>
    </div>
  );
}
