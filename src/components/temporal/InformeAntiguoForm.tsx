import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

import { EquiposRegistradosCampos, filaEquipoVacia } from './EquiposRegistradosCampos';
import { PersonalActividad, type LineaPersonal } from './PersonalActividad';
import { FotoRespaldoField } from '../flota/FotoRespaldoField';
import { DateField } from '../terreno/DateField';
import { Boton, Campo, Input, Label, Segmentado, Selector, Textarea } from '../terreno/ui';
import { useCrearInformeAntiguo, useNumeroInformeOcupado } from '../../hooks/useInformesTemporales';
import { useUsers } from '../../hooks/useUsers';
import {
  armarInformeAntiguo,
  mensajeNumeroTomado,
  numeroDeInforme,
  validarInformeAntiguo,
  type InformeAntiguoForm as Form,
} from '../../lib/informe-antiguo';
import { MAX_ACTIVIDAD_INFORME, MAX_OBSERVACIONES_INFORME } from '../../lib/informe-temporal';
import { toDateOnly, type Turno } from '../../lib/turno';
import { usePhotoCaptureFlow } from '../../lib/usePhotoCaptureFlow';

type DatosForm = Omit<Form, 'personal1' | 'personal2'> & { personal1: LineaPersonal[]; personal2: LineaPersonal[] };

/** Un año atrás: la misma ventana que acepta el backend. */
const haceUnAnio = () => {
  const hoy = new Date();
  return toDateOnly(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate()));
};

/**
 * «Subir informe antiguo»: el informe de actividad en papel de una jornada
 * pasada, digitalizado después. A diferencia del cierre, NO tiene tarjetas:
 * el N° es el del papel (tiene que estar libre), la fecha es la del papel y
 * los equipos se escriben a mano — no abren ni cierran nada ni mueven
 * contadores. La foto del report es opcional.
 *
 * Lo usan el supervisor temporal (queda a su nombre) y la oficina
 * (`oficina`: elige de qué supervisor temporal es). Va por la cola como el
 * informe normal: el `informeId` lo genera quien abre la hoja, UNA vez, y se
 * repite en cada reintento.
 */
export function InformeAntiguoForm({
  informeId,
  oficina = false,
  supervisorNombre = '',
  numerosConocidos,
  onEnviado,
  onCambiosChange,
  onEnviandoChange,
}: {
  informeId: string;
  /** ADMIN/SECRETARIA: se elige el supervisor temporal dueño del informe. */
  oficina?: boolean;
  /** Supervisor responsable 1 por defecto (el supervisor temporal que lo sube). */
  supervisorNombre?: string;
  /** N° de informes que ya se conocen en el equipo (sirve sin señal). */
  numerosConocidos: readonly number[];
  onEnviado: () => void;
  onCambiosChange?: (conCambios: boolean) => void;
  onEnviandoChange?: (enviando: boolean) => void;
}) {
  const crear = useCrearInformeAntiguo();
  const { data: supervisores = [] } = useUsers({ role: 'SUPERVISOR_TEMPORAL' }, oficina);
  const foto = usePhotoCaptureFlow(() => {}, { ocr: false });

  const [iniciales] = useState<DatosForm>(() => ({
    numero: '',
    fecha: toDateOnly(new Date()),
    turno: 'DIURNO',
    actividad1: '',
    actividad2: '',
    personal1: [],
    personal2: [],
    observaciones: '',
    supervisor1: supervisorNombre,
    supervisor2: '',
    supervisorId: '',
    equipos: [filaEquipoVacia()],
  }));
  const [datos, setDatos] = useState<DatosForm>(iniciales);
  const cambiar = <K extends keyof DatosForm>(campo: K, valor: DatosForm[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  // El N° se revisa contra los informes conocidos (sirve sin señal) y, con
  // señal, contra el servidor, que ve los de todos los supervisores.
  const numero = numeroDeInforme(datos.numero);
  const { ocupado } = useNumeroInformeOcupado(numero);
  const tomados = useMemo(() => {
    const set = new Set(numerosConocidos);
    if (ocupado === true && numero != null) set.add(numero);
    return set;
  }, [numerosConocidos, ocupado, numero]);
  const hoy = toDateOnly(new Date());
  const errores = validarInformeAntiguo(datos, { numerosTomados: tomados, exigirSupervisor: oficina, hoy });
  const [intentado, setIntentado] = useState(false);
  // Un N° repetido se avisa apenas se escribe (bloquea el envío); el resto, al intentar.
  const visibles: Record<string, string> = intentado
    ? errores
    : numero != null && tomados.has(numero)
      ? { numero: mensajeNumeroTomado(numero) }
      : {};
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const arriba = useRef<HTMLDivElement>(null);

  const conCambios =
    foto.file != null ||
    datos.equipos.some((f) => f.equipoId !== '' || f.inicial !== '' || f.final !== '' || f.litros !== '') ||
    (Object.keys(iniciales) as (keyof DatosForm)[])
      .filter((campo) => campo !== 'equipos')
      .some((campo) => {
        const valor = datos[campo];
        return Array.isArray(valor) ? valor.length > 0 : valor !== iniciales[campo];
      });
  useEffect(() => onCambiosChange?.(conCambios), [onCambiosChange, conCambios]);
  useEffect(() => onEnviandoChange?.(crear.isPending), [onEnviandoChange, crear.isPending]);

  const enviar = async () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0 || crear.isPending || foto.isReadingPhoto) {
      arriba.current?.querySelector('[role="alert"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrorServidor(null);
    const informe = armarInformeAntiguo(datos, { id: informeId, conSupervisor: oficina });
    try {
      await crear.mutateAsync({ informe, foto: foto.file });
      onEnviado();
    } catch (error) {
      setErrorServidor(error instanceof Error ? error.message : 'No se pudo guardar el informe.');
      arriba.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div ref={arriba} className="flex flex-col gap-4">
      {errorServidor && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-[13.5px] text-[var(--danger-soft-foreground)]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{errorServidor}</span>
        </div>
      )}

      {oficina && (
        <Campo label="Supervisor temporal" requerido error={visibles.supervisorId}>
          <Selector
            etiqueta="Supervisor temporal"
            placeholder="Elige de quién es el informe"
            valor={datos.supervisorId}
            onChange={(id) => {
              cambiar('supervisorId', id);
              const elegido = supervisores.find((u) => u.id === id);
              if (elegido && datos.supervisor1.trim() === '') cambiar('supervisor1', elegido.name);
            }}
            opciones={supervisores.map((u) => ({ valor: u.id, titulo: u.name, detalle: u.email }))}
          />
        </Campo>
      )}

      <Campo label="N° del informe" requerido hint="El número impreso en el informe en papel." error={visibles.numero}>
        <Input entero value={datos.numero} maxLength={7} onChange={(e) => cambiar('numero', e.target.value)} />
      </Campo>

      <DateField label="Fecha" value={datos.fecha} min={haceUnAnio()} max={hoy} onChange={(f) => cambiar('fecha', f)} />
      {visibles.fecha && (
        <span role="alert" className="-mt-2 text-[12.5px] font-semibold text-[var(--danger)]">
          {visibles.fecha}
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <Label>Turno</Label>
        <Segmentado<Turno>
          etiqueta="Turno"
          valor={datos.turno}
          onChange={(t) => cambiar('turno', t)}
          opciones={[
            { valor: 'DIURNO', label: 'Día' },
            { valor: 'NOCTURNO', label: 'Noche' },
          ]}
        />
      </div>

      <EquiposRegistradosCampos
        filas={datos.equipos}
        onChange={(filas) => cambiar('equipos', filas)}
        errores={visibles}
      />

      <Campo label="Actividad realizada 1" requerido error={visibles.actividad1}>
        <Input
          value={datos.actividad1}
          maxLength={MAX_ACTIVIDAD_INFORME}
          onChange={(e) => cambiar('actividad1', e.target.value)}
        />
      </Campo>
      <Campo label="Actividad realizada 2" error={visibles.actividad2}>
        <Input
          value={datos.actividad2}
          maxLength={MAX_ACTIVIDAD_INFORME}
          onChange={(e) => cambiar('actividad2', e.target.value)}
        />
      </Campo>

      <PersonalActividad
        actividad={1}
        lineas={datos.personal1}
        onChange={(l) => cambiar('personal1', l)}
        error={visibles.personal1}
      />
      <PersonalActividad
        actividad={2}
        lineas={datos.personal2}
        onChange={(l) => cambiar('personal2', l)}
        error={visibles.personal2}
      />

      <Campo label="Observaciones">
        <Textarea
          rows={3}
          maxLength={MAX_OBSERVACIONES_INFORME}
          value={datos.observaciones}
          onChange={(e) => cambiar('observaciones', e.target.value)}
        />
      </Campo>
      <Campo label="Supervisor responsable 1" requerido error={visibles.supervisor1}>
        <Input value={datos.supervisor1} maxLength={120} onChange={(e) => cambiar('supervisor1', e.target.value)} />
      </Campo>
      <Campo label="Supervisor responsable 2">
        <Input value={datos.supervisor2} maxLength={120} onChange={(e) => cambiar('supervisor2', e.target.value)} />
      </Campo>

      <FotoRespaldoField
        file={foto.file}
        isReadingPhoto={foto.isReadingPhoto}
        captureDate={foto.captureDate}
        onSelect={(file) => void foto.handleSelectPhoto(file)}
        onClear={foto.handleClearPhoto}
        requerida={false}
        registroAnterior
        guia="Encuadra el informe completo, legible y con el N° a la vista."
        title="Foto del informe en papel"
        subtitle="Opcional: queda como respaldo del informe."
        staleQuestion="¿Es la foto de este informe?"
      />

      <Boton ancho onClick={() => void enviar()} disabled={crear.isPending || foto.isReadingPhoto}>
        {crear.isPending ? 'Subiendo informe…' : 'Subir informe'} <ArrowRight className="size-[19px]" />
      </Boton>
      {intentado && Object.keys(errores).length > 0 && (
        <p className="m-0 text-center text-[12.5px] text-[var(--danger)]">Revisa los campos marcados en rojo.</p>
      )}
    </div>
  );
}
