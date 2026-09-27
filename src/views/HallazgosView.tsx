import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Camera } from 'lucide-react';

import { hallazgoFormSchema, type HallazgoForm } from '../types/hallazgos';
import { useHallazgosList, useCreateHallazgo } from '../hooks/useHallazgos';
import { useEquipment } from '../hooks/useEquipment';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { fmtDate, fmtTime } from '../lib/format';
import { PhotoButtons } from '../components/terreno/mobile';
import {
  Automatico,
  Automaticos,
  Boton,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  ChipEstado,
  Form,
  GrupoHead,
  Label,
  Select,
  Tabla,
  Tarjeta,
  Textarea,
  TD,
  TH,
  VistaHead,
  VistaSplit,
  type Tono,
} from '../components/terreno/ui';

const PRIORIDADES = [
  { valor: 'BAJA' as const, label: 'BAJA', colorActivo: '#353c46' },
  { valor: 'MEDIA' as const, label: 'MEDIA', colorActivo: '#1d4ed8' },
  { valor: 'ALTA' as const, label: 'ALTA', colorActivo: '#b86e00' },
  { valor: 'CRITICA' as const, label: 'CRÍTICA', colorActivo: '#b01818' },
];

/**
 * El tono sube con la prioridad: gris, azul, ámbar, rojo. Un hallazgo crítico
 * tiene que saltar en una lista de veinte, y el color es lo primero que se lee.
 */
const prioridadTono: Record<string, Tono> = {
  BAJA: 'neutral',
  MEDIA: 'info',
  ALTA: 'warning',
  CRITICA: 'danger',
};
const prioridadLabel: Record<string, string> = { BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'ALTA', CRITICA: 'CRÍTICA' };

/** El borde izquierdo de la tarjeta repite la prioridad, para barrer la lista. */
const prioridadAcento: Record<string, string> = {
  BAJA: '#928d80',
  MEDIA: '#1d4ed8',
  ALTA: '#b86e00',
  CRITICA: '#b01818',
};

const estadoColor: Record<string, string> = {
  ABIERTO: '#971414',
  EN_PROCESO: '#1a3a9c',
  CERRADO: '#156237',
};
const estadoLabel: Record<string, string> = {
  ABIERTO: 'ABIERTO',
  EN_PROCESO: 'EN PROCESO',
  CERRADO: 'CERRADO',
};

export function HallazgosView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
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

  const sinCerrar = hallazgos.filter((h) => h.estado !== 'CERRADO').length;

  const formulario = (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHead titulo="Nuevo hallazgo" bajada="Una falla o condición que alguien tiene que revisar." />
        <Form>
          <Campo label="Equipo" hint={errors.equipoId?.message}>
            <Select {...register('equipoId')}>
              <option value="">Seleccioná…</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.internalCode} · {e.type}
                </option>
              ))}
            </Select>
          </Campo>

          {/* Segmentado y no desplegable: son cuatro opciones y la elegida es
              la que define la urgencia. Esconderla detrás de un toque extra
              invita a dejar la que venía por defecto. */}
          <div className="flex flex-col gap-1.5">
            <Label>Nivel de prioridad</Label>
            <div role="group" aria-label="Nivel de prioridad" className="grid grid-cols-4 gap-1.5 rounded-2xl bg-[#eef0f2] p-1">
              {PRIORIDADES.map((p) => {
                const activo = p.valor === prioridad;
                return (
                  <button
                    key={p.valor}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setValue('prioridad', p.valor)}
                    className={`flex min-h-[46px] cursor-pointer items-center justify-center rounded-xl text-[13.5px] font-semibold ${
                      activo ? 'text-white shadow-[0_1px_3px_rgba(20,23,28,.14)]' : 'text-[#3a414b]'
                    }`}
                    style={activo ? { background: p.colorActivo } : undefined}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Campo label="Descripción" hint={errors.descripcion?.message}>
            <Textarea rows={3} placeholder="Qué se detectó, dónde y en qué condición" {...register('descripcion')} />
          </Campo>

          <div className="flex flex-col gap-1.5">
            <Label>
              Foto
              <span className="text-[11px] font-medium tracking-normal text-muted-foreground normal-case">
                (opcional)
              </span>
            </Label>
            <PhotoButtons value={fotoUrl} onChange={(u) => setValue('fotoUrl', u)} />
          </div>

          {/* Un hallazgo nace abierto: el estado no se elige, se informa. */}
          <Automaticos>
            <Automatico label="Estado" valor={<ChipEstado color={estadoColor.ABIERTO}>ABIERTO</ChipEstado>} />
          </Automaticos>

          <Boton ancho type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar hallazgo'}
            <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
        </Form>
      </Card>
    </form>
  );

  const historial =
    hallazgos.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Sin hallazgos del turno.
      </p>
    ) : esEscritorio ? (
      <Tabla titulo="Hallazgos recientes" detalle={`${sinCerrar} sin cerrar`}>
        <thead>
          <tr>
            <th className={TH}>Fecha</th>
            <th className={TH}>Equipo</th>
            <th className={TH}>Prioridad</th>
            <th className={TH}>Descripción</th>
            <th className={TH}>Foto</th>
            <th className={TH}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {hallazgos.map((h) => (
            <tr key={h.id}>
              <td className={`${TD} tabular whitespace-nowrap`}>
                {fmtDate(h.fecha)} · {fmtTime(h.fecha)}
              </td>
              <td className={TD}>
                <b className="tabular block text-[15px] font-semibold">{h.equipo?.internalCode ?? h.equipoId}</b>
              </td>
              <td className={TD}>
                <Chip tono={prioridadTono[h.prioridad] ?? 'neutral'}>
                  {prioridadLabel[h.prioridad] ?? h.prioridad}
                </Chip>
              </td>
              {/* La descripción se lleva el ancho sobrante: es el texto largo
                  de la fila y el resto de las columnas no se deforma. */}
              <td className={`${TD} w-full max-w-0 truncate`}>{h.descripcion}</td>
              <td className={TD}>
                {h.fotoUrl ? (
                  <Camera className="h-4 w-4 text-[var(--success-soft-foreground)]" />
                ) : (
                  <span className="text-[#9aa2ad]">—</span>
                )}
              </td>
              <td className={TD}>
                <ChipEstado color={estadoColor[h.estado] ?? '#353c46'}>
                  {estadoLabel[h.estado] ?? h.estado}
                </ChipEstado>
              </td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    ) : (
      <>
        <GrupoHead titulo="Hallazgos recientes" detalle={`${sinCerrar} sin cerrar`} />
        <div className="flex flex-col gap-3">
          {hallazgos.map((h) => (
            <Tarjeta
              key={h.id}
              className="border-l-4"
              style={{ borderLeftColor: prioridadAcento[h.prioridad] ?? '#928d80' }}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <div className="tabular text-[19px] font-semibold tracking-[-0.01em]">
                    {h.equipo?.internalCode ?? h.equipoId}
                  </div>
                  <div className="text-[13px] text-muted-foreground">{fmtTime(h.fecha)}</div>
                </div>
                <Chip tono={prioridadTono[h.prioridad] ?? 'neutral'}>
                  {prioridadLabel[h.prioridad] ?? h.prioridad}
                </Chip>
              </div>
              <p className="m-0 text-[15px]">{h.descripcion}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular text-[13px] text-muted-foreground">
                  {fmtDate(h.fecha)}
                  {h.fotoUrl ? ' · con foto' : ''}
                </span>
                <ChipEstado color={estadoColor[h.estado] ?? '#353c46'}>
                  {estadoLabel[h.estado] ?? h.estado}
                </ChipEstado>
              </div>
            </Tarjeta>
          ))}
        </div>
      </>
    );

  return (
    <>
      <VistaHead
        titulo="Hallazgos"
        contexto={
          <>
            <ChipContexto>Faena Patillo</ChipContexto>
            <ChipContexto>DIURNO · 08–20</ChipContexto>
          </>
        }
      />
      <VistaSplit formulario={formulario} historial={historial} />
    </>
  );
}
