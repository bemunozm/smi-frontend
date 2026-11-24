import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight } from 'lucide-react';

import { CierreTarjetaFila, type FilaCierreEstado } from './CierreTarjetaFila';
import { PersonalActividad, type LineaPersonal } from './PersonalActividad';
import { DateField } from '../terreno/DateField';
import { Boton, Campo, Hint, Input, Label, Segmentado, Textarea } from '../terreno/ui';
import { useCrearInformeTemporal } from '../../hooks/useInformesTemporales';
import { DomainError } from '../../lib/api-error';
import {
  armarInformeTemporal,
  validarInformeTemporal,
  type InformeTemporalForm,
  type TarjetaTemporal,
} from '../../lib/informe-temporal';
import { SHIFT_CARDS_KEY } from '../../lib/query-keys';
import { fechaDeTurno, toDateOnly, turnoDe, type Turno } from '../../lib/turno';
import { generateUuid } from '../../lib/uuid';

type DatosInforme = Omit<InformeTemporalForm, 'cierres' | 'personal1' | 'personal2'> & {
  personal1: LineaPersonal[];
  personal2: LineaPersonal[];
};

const filaVacia = (t: TarjetaTemporal): FilaCierreEstado => ({
  cardId: t.id,
  inicial: t.inicial,
  liviano: t.liviano,
  final: '',
  litros: '',
  foto: null,
  fotoCapturada: null,
  leyendoFoto: false,
  adBlue: false,
  adBlueLitros: '',
});

const SI_NO = [
  { valor: 'no' as const, label: 'No' },
  { valor: 'si' as const, label: 'Sí' },
];

function PreguntaSiNo({
  pregunta,
  valor,
  onChange,
}: {
  pregunta: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{pregunta}</Label>
      <Segmentado
        etiqueta={pregunta}
        valor={valor ? 'si' : 'no'}
        onChange={(v) => onChange(v === 'si')}
        opciones={SI_NO}
      />
    </div>
  );
}

/**
 * «Cerrar y generar informe» del supervisor temporal: el informe de actividad
 * en papel de SIMA, digitalizado. Cierra TODAS sus tarjetas abiertas (una fila
 * por tarjeta) y registra la jornada en un solo envío (`useCrearInformeTemporal`).
 *
 * Idempotencia: el `id` del informe (`informeId`, de quien abre) y el
 * `closeClientId` de cada tarjeta se generan UNA vez, al abrir el formulario, y se repiten en cada reintento tras
 * un error. Se regeneran recién en el próximo formulario (este se desmonta al
 * enviar). Con señal, un 409 del servidor se muestra arriba del formulario.
 */
export function CierreTemporalForm({
  informeId,
  tarjetas,
  supervisorNombre,
  onEnviado,
}: {
  /** Generado UNA vez por quien abre el formulario (la pantalla lo necesita para
   * no ocultar las tarjetas de este informe mientras espera al servidor). */
  informeId: string;
  tarjetas: TarjetaTemporal[];
  supervisorNombre: string;
  /** El informe se guardó (enviado o en la cola): quien lo abrió cierra la hoja. */
  onEnviado: () => void;
}) {
  const crear = useCrearInformeTemporal();
  const queryClient = useQueryClient();

  const closeIds = useRef<Map<string, string> | null>(null);
  if (closeIds.current == null) closeIds.current = new Map(tarjetas.map((t) => [t.id, generateUuid()]));
  const closeClientIdDe = (cardId: string) => {
    const ids = closeIds.current!;
    if (!ids.has(cardId)) ids.set(cardId, generateUuid());
    return ids.get(cardId)!;
  };

  const [datos, setDatos] = useState<DatosInforme>(() => {
    const ahora = new Date();
    return {
      fecha: toDateOnly(fechaDeTurno(ahora)),
      turno: turnoDe(ahora),
      actividad1: '',
      actividad2: '',
      personal1: [],
      personal2: [],
      observaciones: '',
      supervisor1: supervisorNombre,
      supervisor2: '',
      fotosEnviadas: false,
      infoSubidaApp: false,
    };
  });
  const cambiar = <K extends keyof DatosInforme>(campo: K, valor: DatosInforme[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  const [estadoFilas, setEstadoFilas] = useState<Record<string, FilaCierreEstado>>(() =>
    Object.fromEntries(tarjetas.map((t) => [t.id, filaVacia(t)])),
  );
  const filas = tarjetas.map((t) => estadoFilas[t.id] ?? filaVacia(t));
  const cambiarFila = useCallback((cardId: string, cambio: Partial<FilaCierreEstado>) => {
    setEstadoFilas((actual) => {
      const base = actual[cardId];
      return base ? { ...actual, [cardId]: { ...base, ...cambio } } : actual;
    });
  }, []);
  // Una tarjeta nueva en la lista (tras un 409 se refrescan) entra con su fila vacía.
  if (tarjetas.some((t) => !estadoFilas[t.id])) {
    setEstadoFilas((actual) => {
      const siguiente = { ...actual };
      for (const t of tarjetas) siguiente[t.id] ??= filaVacia(t);
      return siguiente;
    });
  }

  const form: InformeTemporalForm = { ...datos, cierres: filas };
  const errores = validarInformeTemporal(form);
  const [intentado, setIntentado] = useState(false);
  const visibles = intentado ? errores : {};
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const arriba = useRef<HTMLDivElement>(null);
  const leyendoFoto = filas.some((f) => f.leyendoFoto);

  const enviar = async () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0 || crear.isPending || leyendoFoto || tarjetas.length === 0) return;
    setErrorServidor(null);
    const { informe, fotos } = armarInformeTemporal(form, { id: informeId, closeClientIdDe, ahora: new Date() });
    try {
      // `sent` y `queued` avisan desde el hook («Informe guardado» / «Se enviará al recuperar señal»).
      await crear.mutateAsync({ informe, fotos });
      onEnviado();
    } catch (error) {
      setErrorServidor(error instanceof Error ? error.message : 'No se pudo guardar el informe.');
      // Las tarjetas abiertas no calzan con las del informe: se releen del servidor.
      if (error instanceof DomainError && error.code === 'INFORME_TARJETAS_DESCUADRADAS') {
        void queryClient.invalidateQueries({ queryKey: SHIFT_CARDS_KEY });
      }
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

      <div className="flex flex-col gap-2.5">
        <Label>Equipos utilizados · {tarjetas.length}</Label>
        {tarjetas.length === 0 && <Hint>No te quedan equipos abiertos para cerrar.</Hint>}
        {tarjetas.map((t, i) => (
          <CierreTarjetaFila key={t.id} tarjeta={t} fila={filas[i]!} errores={visibles} onCambio={cambiarFila} />
        ))}
      </div>

      <DateField label="Fecha" value={datos.fecha} max={toDateOnly(new Date())} onChange={(f) => cambiar('fecha', f)} />
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

      <Campo label="Actividad realizada 1" requerido error={visibles.actividad1}>
        <Input value={datos.actividad1} maxLength={200} onChange={(e) => cambiar('actividad1', e.target.value)} />
      </Campo>
      <Campo label="Actividad realizada 2" error={visibles.actividad2}>
        <Input value={datos.actividad2} maxLength={200} onChange={(e) => cambiar('actividad2', e.target.value)} />
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
          maxLength={1000}
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

      <PreguntaSiNo
        pregunta="¿Se enviaron fotos de lo realizado?"
        valor={datos.fotosEnviadas}
        onChange={(v) => cambiar('fotosEnviadas', v)}
      />
      <PreguntaSiNo
        pregunta="¿Se subió información a la app?"
        valor={datos.infoSubidaApp}
        onChange={(v) => cambiar('infoSubidaApp', v)}
      />

      <Boton ancho onClick={() => void enviar()} disabled={crear.isPending || leyendoFoto || tarjetas.length === 0}>
        {crear.isPending ? 'Enviando informe…' : 'Enviar informe'} <ArrowRight className="size-[19px]" />
      </Boton>
      {intentado && Object.keys(errores).length > 0 && (
        <p className="m-0 text-center text-[12.5px] text-[var(--danger)]">Revisa los campos marcados en rojo.</p>
      )}
    </div>
  );
}
