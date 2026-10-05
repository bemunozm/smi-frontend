import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Camera, Check, Pencil } from 'lucide-react';

import { hallazgoFormSchema, type Hallazgo, type HallazgoForm } from '../types/hallazgos';
import type { CorreccionHallazgo } from '../api/HallazgosAPI';
import { useAhora } from '../hooks/useAhora';
import { contextoTurno } from '../lib/turno';
import { useRegistrarHallazgo, useUpdateHallazgo, useCambiosHallazgo } from '../hooks/useHallazgos';
import { useHallazgosProjection } from '../hooks/useHallazgosProjection';
import { useEquipment } from '../hooks/useEquipment';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { fmtDate, fmtTime } from '../lib/format';
import { FotoRespaldoField } from '../components/flota/FotoRespaldoField';
import { MarcaSinSincronizar } from '../components/terreno/MarcaSinSincronizar';
import { usePhotoCaptureFlow } from '../lib/usePhotoCaptureFlow';
import {
  Automatico,
  Automaticos,
  AvisoEdicion,
  Boton,
  Campo,
  Card,
  CardHead,
  Chip,
  ChipContexto,
  ChipEstado,
  Form,
  GrupoHead,
  HistorialCambios,
  Label,
  ModalTerreno,
  Segmentado,
  Selector,
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
/** Un registro guardado solo en el equipo todavía no existe en el servidor: no hay qué editar. */
const MOTIVO_SIN_SINCRONIZAR = 'Se puede editar cuando termine de sincronizarse.';

const estadoLabel: Record<string, string> = {
  ABIERTO: 'ABIERTO',
  EN_PROCESO: 'EN PROCESO',
  CERRADO: 'CERRADO',
};

export function HallazgosView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const { data: equipos = [] } = useEquipment();
  const { hallazgos } = useHallazgosProjection();
  const { registrar, isGuardando } = useRegistrarHallazgo();

  /** Hallazgo que se está corrigiendo (R13); se lee de la lista para ver lo último. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const editando = hallazgos.find((h) => h.id === editandoId) ?? null;

  // El turno del título sale del reloj, como en Registro: antes decía
  // «DIURNO · 08–20» escrito a mano, también de noche.
  const ahora = useAhora();
  const turno = useMemo(() => contextoTurno(ahora), [ahora]);

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
  /**
   * Un hallazgo no tiene un display que leer, así que el OCR de litros se
   * apaga. Del flujo se usa el resto: EXIF para avisar si la foto es vieja.
   * La foto NO se sube acá: viaja en el outbox junto al hallazgo y se sube
   * en el replay, así que el formulario funciona igual sin señal.
   */
  const foto = usePhotoCaptureFlow(() => {}, { ocr: false });

  const onSubmit = async (values: HallazgoForm) => {
    const guardado = await registrar(values, foto.file);
    if (!guardado) return;
    reset({ equipoId: '', descripcion: '', prioridad: 'MEDIA' });
    foto.resetPhoto();
  };

  const sinCerrar = hallazgos.filter((h) => h.estado !== 'CERRADO').length;

  const formulario = (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHead titulo="Nuevo hallazgo" bajada="Una falla o condición que alguien tiene que revisar." />
        <Form>
          <Campo label="Equipo" hint={errors.equipoId?.message}>
            <Selector
              etiqueta="Equipo"
              tituloTabular
              valor={watch('equipoId') ?? ''}
              onChange={(id) => setValue('equipoId', id, { shouldValidate: true })}
              opciones={equipos.map((e) => ({ valor: e.id, titulo: e.internalCode, detalle: e.type }))}
            />
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

          {/* El mismo campo que usan la entrada, la salida y la carga de
              combustible: sube a storage privado y devuelve una key, en vez
              de la URL pública de `/api/uploads`. */}
          <FotoRespaldoField
            file={foto.file}
            isReadingPhoto={foto.isReadingPhoto}
            isUploadingPhoto={foto.isUploadingPhoto}
            captureDate={foto.captureDate}
            onSelect={foto.handleSelectPhoto}
            onClear={foto.handleClearPhoto}
            requerida={false}
            guia="Encuadrá la pieza o la zona afectada, de cerca y con luz — es lo que va a ver quien tome el hallazgo."
            title="Foto del hallazgo"
            subtitle="Ayuda a que quien lo revise entienda qué se detectó."
            staleQuestion="¿Es del hallazgo de este turno?"
          />

          {/* Un hallazgo nace abierto: el estado no se elige, se informa. */}
          <Automaticos>
            <Automatico label="Estado" valor={<ChipEstado color={estadoColor.ABIERTO}>ABIERTO</ChipEstado>} />
          </Automaticos>

          <Boton ancho type="submit" disabled={isGuardando}>
            {isGuardando ? 'Guardando…' : 'Registrar hallazgo'}
            <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
          {/* Dice a quién llega para que el supervisor no lo avise además
              por radio o WhatsApp (Acta N.° 004, R11). */}
          <p className="m-0 text-center text-[12.5px] text-muted-foreground">
            Al registrarlo se avisa a los mantenedores y al administrador, en el sistema y por correo.
          </p>
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
            <th className={TH}>
              <span className="sr-only">Editar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {hallazgos.map((h) => (
            <tr key={h.id}>
              <td className={`${TD} tabular whitespace-nowrap`}>
                {fmtDate(h.fecha)} · {fmtTime(h.fecha)}
                {h.sinSincronizar && (
                  <MarcaSinSincronizar requiereAtencion={h.requiereAtencion} fotoPendiente={h.fotoPendiente} />
                )}
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
              <td className={`${TD} text-right`}>
                <Boton
                  variante="contorno"
                  className="!min-h-10 !px-3 !text-[13.5px]"
                  aria-label={`Editar hallazgo de ${h.equipo?.internalCode ?? h.equipoId}${h.sinSincronizar ? `. ${MOTIVO_SIN_SINCRONIZAR}` : ''}`}
                  title={h.sinSincronizar ? MOTIVO_SIN_SINCRONIZAR : undefined}
                  disabled={h.sinSincronizar}
                  onClick={() => setEditandoId(h.id)}
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Boton>
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
              {h.sinSincronizar && (
                <MarcaSinSincronizar requiereAtencion={h.requiereAtencion} fotoPendiente={h.fotoPendiente} />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular text-[13px] text-muted-foreground">
                  {fmtDate(h.fecha)}
                  {h.fotoUrl ? ' · con foto' : ''}
                </span>
                <ChipEstado color={estadoColor[h.estado] ?? '#353c46'}>
                  {estadoLabel[h.estado] ?? h.estado}
                </ChipEstado>
              </div>
              <Boton
                variante="contorno"
                ancho
                className="!min-h-11 !text-[14.5px]"
                aria-label={`Editar hallazgo de ${h.equipo?.internalCode ?? h.equipoId}`}
                disabled={h.sinSincronizar}
                onClick={() => setEditandoId(h.id)}
              >
                <Pencil className="h-4 w-4" /> Editar
              </Boton>
              {h.sinSincronizar && (
                <p className="m-0 text-center text-[12.5px] text-muted-foreground">{MOTIVO_SIN_SINCRONIZAR}</p>
              )}
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
            <ChipContexto>{turno.etiqueta}</ChipContexto>
          </>
        }
      />
      <VistaSplit formulario={formulario} historial={historial} />

      <ModalTerreno
        abierto={editando != null}
        onAbiertoChange={(abierto) => !abierto && setEditandoId(null)}
        titulo={editando ? `Editar · hallazgo de ${editando.equipo?.internalCode ?? editando.equipoId}` : ''}
        detalle={editando ? `Registrado el ${fmtDate(editando.fecha)} a las ${fmtTime(editando.fecha)}` : undefined}
      >
        {/* `key`: al abrir otro hallazgo el formulario arranca con sus datos. */}
        {editando && (
          <EditorHallazgo
            key={editando.id}
            hallazgo={editando}
            equipos={equipos}
            onCerrar={() => setEditandoId(null)}
          />
        )}
      </ModalTerreno>
    </>
  );
}

/**
 * Corregir un hallazgo ya registrado (Acta N.° 004, R13): un error humano
 * —el equipo equivocado, una prioridad mal elegida— se arregla sin pedir
 * permiso, pero con el aviso al administrador arriba y el historial de quién
 * cambió qué abajo. La foto no se toca: es el respaldo de lo que se vio.
 */
function EditorHallazgo({
  hallazgo,
  equipos,
  onCerrar,
}: {
  hallazgo: Hallazgo;
  equipos: { id: string; internalCode: string; type: string }[];
  onCerrar: () => void;
}) {
  const actualizar = useUpdateHallazgo();
  const cambios = useCambiosHallazgo(hallazgo.id);
  const [form, setForm] = useState<CorreccionHallazgo>({
    equipoId: hallazgo.equipoId,
    descripcion: hallazgo.descripcion,
    prioridad: hallazgo.prioridad,
    estado: hallazgo.estado,
  });
  const [guardado, setGuardado] = useState(false);
  const descripcionCorta = form.descripcion.trim().length < 3;

  return (
    <div className="flex flex-col gap-4">
      {guardado && (
        <p className="m-0 flex items-center gap-2 rounded-2xl bg-[var(--success-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--success-soft-foreground)]">
          <Check className="h-4 w-4 shrink-0" /> Cambio guardado. Se avisó al administrador.
        </p>
      )}
      <AvisoEdicion />
      <Form>
        <Campo label="Equipo">
          <Selector
            etiqueta="Equipo"
            tituloTabular
            valor={form.equipoId}
            onChange={(equipoId) => setForm((f) => ({ ...f, equipoId }))}
            opciones={equipos.map((e) => ({ valor: e.id, titulo: e.internalCode, detalle: e.type }))}
          />
        </Campo>
        <div className="flex flex-col gap-1.5">
          <Label>Nivel de prioridad</Label>
          <Segmentado
            etiqueta="Nivel de prioridad"
            valor={form.prioridad}
            onChange={(prioridad) => setForm((f) => ({ ...f, prioridad }))}
            opciones={PRIORIDADES}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Estado</Label>
          <Segmentado
            etiqueta="Estado"
            valor={form.estado}
            onChange={(estado) => setForm((f) => ({ ...f, estado }))}
            opciones={Object.entries(estadoLabel).map(([valor, label]) => ({
              valor,
              label,
              colorActivo: estadoColor[valor],
            }))}
          />
        </div>
        <Campo label="Descripción" hint={descripcionCorta ? 'Describí el hallazgo.' : undefined}>
          <Textarea
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </Campo>
        <Boton
          ancho
          disabled={actualizar.isPending || descripcionCorta}
          onClick={() =>
            actualizar.mutate(
              { id: hallazgo.id, payload: { ...form, descripcion: form.descripcion.trim() } },
              { onSuccess: () => setGuardado(true) },
            )
          }
        >
          {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
          <ArrowRight className="h-[19px] w-[19px]" />
        </Boton>
        <Boton variante="contorno" ancho onClick={onCerrar}>
          {guardado ? 'Listo' : 'Cancelar'}
        </Boton>
      </Form>
      <HistorialCambios entradas={cambios.data ?? []} cargando={cambios.isLoading} />
    </div>
  );
}
