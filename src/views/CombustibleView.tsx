import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { combustibleFormSchema, type CombustibleForm, type CombustibleFormInput } from '../types/combustible';
import { useCombustibleList, useCreateCombustible } from '../hooks/useCombustible';
import { useEquipment } from '../hooks/useEquipment';
import { assetUrl } from '../api/UploadsAPI';
import { fmtDate, fmtNum, fmtTime } from '../lib/format';
import { FotoRespaldoField } from '../components/flota/FotoRespaldoField';
import { usePhotoCaptureFlow } from '../lib/usePhotoCaptureFlow';
import {
  Card,
  Chip,
  Field,
  FieldLabel,
  ListCard,
  PrimaryButton,
  Segmented,
  SelectField,
} from '../components/terreno/mobile';
import { COLUMNA, Historial, Tabla, VistaTerreno } from '../components/terreno/historial';
import { Table } from '@heroui/react';

const TIPO_ITEMS = [
  { value: 'PETROLEO' as const, label: 'Petróleo' },
  { value: 'BENCINA' as const, label: 'Bencina' },
];
const tipoLabel: Record<string, string> = { PETROLEO: 'Petróleo', BENCINA: 'Bencina' };

export function CombustibleView() {
  const { data: equipos = [] } = useEquipment();
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

  /** El OCR prellena los litros y el campo queda editable: el supervisor
   *  confirma en vez de tipear el totalizador a mano. */
  const foto = usePhotoCaptureFlow((litros) =>
    setValue('litros', litros, { shouldValidate: true }),
  );

  const onSubmit = (values: CombustibleForm) => {
    // La foto viaja con la carga y se sube al sincronizar: sin señal igual queda
    // guardada con su respaldo.
    if (!foto.file) return;
    const input = { equipoId: values.equipoId, litros: values.litros, tipo: values.tipo, fecha: values.fecha };
    crear.mutate(
      { input, foto: foto.file },
      {
        onSuccess: () => {
          reset({ equipoId: '', tipo: 'PETROLEO' });
          foto.resetPhoto();
        },
      },
    );
  };

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

        {/* Mismo bloque que usa Flota: sube a storage privado y devuelve una
            key firmada al leerla, en vez de la URL pública de `/api/uploads`.
            De paso trae el OCR de litros y el aviso de foto vieja por EXIF. */}
        <FotoRespaldoField
          file={foto.file}
          isReadingPhoto={foto.isReadingPhoto}
          captureDate={foto.captureDate}
          onSelect={foto.handleSelectPhoto}
          onClear={foto.handleClearPhoto}
          title="Fotografiar surtidor"
          subtitle="Debe verse el totalizador. Los litros se leen de la foto y quedan editables."
          staleQuestion="¿Es la carga de este turno?"
        />

        <PrimaryButton
          type="submit"
          disabled={crear.isPending || !foto.file || foto.isReadingPhoto}
        >
          {crear.isPending ? 'Guardando…' : 'Registrar carga'}
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
        {/* El label siempre dijo «Requerida» pero nada lo exigía: se podía
            guardar una carga sin respaldo. Ahora el botón lo refleja, y dice
            por qué en vez de quedar apagado sin explicación. */}
        {!foto.file && (
          <p className="m-0 text-center text-[12.5px] text-muted-foreground">
            Falta la foto del surtidor para registrar la carga.
          </p>
        )}
      </Card>
    </form>
  );

  return (
    <VistaTerreno
      formulario={formulario}
      historial={
        <Historial
          titulo="Últimas cargas"
          accion="Ver todas"
          vacio="Sin cargas registradas."
          hayRegistros={registros.length > 0}
          tarjetas={() =>
            registros.map((r) => (
              <ListCard key={r.id}>
                <div className="flex items-center gap-3">
                  <Miniatura fotoUrl={r.fotoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">{r.equipo?.internalCode ?? r.equipoId}</div>
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
            ))
          }
          tabla={() => (
            <Tabla label="Últimas cargas de combustible">
              <Table.Header>
                <Table.Column className={COLUMNA} isRowHeader>
                  Equipo
                </Table.Column>
                {/* La foto del totalizador es obligatoria y es lo que el
                    supervisor viene a mirar: va como columna, no escondida. */}
                <Table.Column className={COLUMNA}>Foto</Table.Column>
                <Table.Column className={COLUMNA}>Litros</Table.Column>
                <Table.Column className={COLUMNA}>Tipo</Table.Column>
                <Table.Column className={COLUMNA}>Fecha</Table.Column>
              </Table.Header>
              <Table.Body>
                {registros.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell className="font-semibold whitespace-nowrap text-foreground">
                      {r.equipo?.internalCode ?? r.equipoId}
                    </Table.Cell>
                    <Table.Cell>
                      <Miniatura fotoUrl={r.fotoUrl} />
                    </Table.Cell>
                    <Table.Cell className="tabular font-bold whitespace-nowrap text-foreground">
                      {fmtNum(r.litros)} L
                    </Table.Cell>
                    <Table.Cell>
                      <Chip tone="neutral">{tipoLabel[r.tipo] ?? r.tipo}</Chip>
                    </Table.Cell>
                    <Table.Cell className="tabular w-full text-sm whitespace-nowrap text-muted-foreground">
                      {fmtDate(r.fecha)} · {fmtTime(r.fecha)}
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

/** La foto de la carga, con el mismo recuadro en la tarjeta y en la tabla. */
function Miniatura({ fotoUrl }: { fotoUrl?: string | null }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
      {fotoUrl ? (
        <img src={assetUrl(fotoUrl)} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}
