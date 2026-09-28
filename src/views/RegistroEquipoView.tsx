import { useMemo, useState } from 'react';
import { ArrowRight, Camera, Check, ChevronDown, Clock, Lock, Mail, User } from 'lucide-react';

import { useEquipment } from '../hooks/useEquipment';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePhotoCaptureFlow } from '../lib/usePhotoCaptureFlow';
import { FotoRespaldoField } from '../components/flota/FotoRespaldoField';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { contextoTurno, fechaCorta, turnoAnterior, type Turno } from '../lib/turno';
import { useAhora } from '../hooks/useAhora';
import { ROLES } from '../types/roles';
import {
  Boton,
  CabeceraTurno,
  Calculado,
  Campo,
  Card,
  CardHead,
  Chip,
  Cifras,
  Form,
  Hint,
  Hoja,
  Input,
  Label,
  Select,
  SeparadorTurno,
  Tabla,
  Tarjeta,
  Textarea,
  TD,
  TH,
  TURNO_ESTILO,
  VistaHead,
  VistaSplit,
} from '../components/terreno/ui';

/**
 * Registro de equipo — Módulo A de la especificación del 21/09/2026.
 *
 * Fusiona lo que hoy son dos pantallas sueltas, Horómetro y Combustible, en una
 * sola tarjeta por equipo: se abre al empezar el turno con el horómetro inicial
 * y se cierra al terminar con el final, los litros y la foto del surtidor.
 *
 * El paso que de verdad importa es el del medio: **enviar el reporte de salida**.
 * Hoy esa información va por WhatsApp y llega tarde — es el problema que el
 * cliente describió en la reunión, con la falla de cargadores que se supo recién
 * al turno siguiente. Por eso el botón no está escondido al final del formulario.
 *
 * ⚠️ MAQUETA PARCIAL. El catálogo de equipos SÍ es real (sale de
 * `useEquipment()` y se filtra por estado operativo, que es la regla R1). Las
 * tarjetas del turno son de ejemplo: el modelo `turno` + `registro_equipo_turno`
 * no existe todavía, ni el reporte de salida en PDF. Nada de lo que se registra
 * acá se guarda.
 */

type Estado = 'curso' | 'cerrada';

/** Los dos turnos que la pantalla muestra: el que corre y el que lo precede. */
type Grupo = 'actual' | 'anterior';

interface TarjetaTurno {
  id: number;
  equipo: string;
  tipo: string;
  operador: string;
  inicial: number;
  final?: number;
  litros?: number;
  grupo: Grupo;
  estado: Estado;
  /**
   * Quién abrió la tarjeta. Un supervisor ve las suyas; el administrador ve
   * todas. En faena hay más de un supervisor por turno y mezclarlas hace que
   * cada uno tenga que buscar las propias en una lista que no es suya.
   */
  supervisor: string;
  cerradaA?: string;
  /** Clave de la foto del surtidor en R2 (no una URL pública). */
  fotoKey?: string;
  /** Registrada sin señal: está en el equipo, todavía no en el servidor. */
  sinSincronizar?: boolean;
  /** Quedó abierta al terminar el turno anterior — ver la nota de Q5. */
  arrastrada?: boolean;
}

const OPERADORES = [
  'Patricio Rojas',
  'Luis Contreras',
  'Marcelo Soto',
  'Cristian Araya',
  'Héctor Villalobos',
  'Sebastián Tapia',
  'Nicolás Espinoza',
  'Jorge Pizarro',
  'Rubén Carrasco',
  'Mauricio Olivares',
  'Felipe Gallardo',
];

/**
 * Supervisor de ejemplo con el que quedan las tarjetas que NO son del usuario
 * conectado — sirve para ver que el filtro por supervisor hace algo.
 */
const OTRO_SUPERVISOR = 'Marcela Pizarro';

/** Las tarjetas del usuario conectado llevan este marcador hasta que se sabe
 *  su nombre real (la sesión llega un tick después del primer render). */
const MIAS = '@yo';

const TARJETAS_EJEMPLO: TarjetaTurno[] = [
  { id: 1, equipo: 'CA-011', tipo: 'Cargador', operador: 'Patricio Rojas', inicial: 12487.3, grupo: 'actual', estado: 'curso', supervisor: MIAS },
  { id: 2, equipo: 'PE-004', tipo: 'Perforadora', operador: 'Luis Contreras', inicial: 8412.6, grupo: 'actual', estado: 'curso', supervisor: MIAS },
  { id: 3, equipo: 'EX-002', tipo: 'Excavadora', operador: 'Marcelo Soto', inicial: 6105.0, grupo: 'actual', estado: 'curso', supervisor: MIAS },
  { id: 4, equipo: 'CM-015', tipo: 'Camión', operador: 'Cristian Araya', inicial: 21330.4, grupo: 'actual', estado: 'curso', supervisor: MIAS, sinSincronizar: true },
  { id: 5, equipo: 'CM-021', tipo: 'Camión', operador: 'Héctor Villalobos', inicial: 19876.2, grupo: 'actual', estado: 'curso', supervisor: OTRO_SUPERVISOR, sinSincronizar: true },
  { id: 9, equipo: 'CA-007', tipo: 'Cargador', operador: 'Felipe Gallardo', inicial: 9940.5, grupo: 'anterior', estado: 'curso', supervisor: MIAS, arrastrada: true },
  { id: 6, equipo: 'CA-011', tipo: 'Cargador', operador: 'Jorge Pizarro', inicial: 12475.8, final: 12487.3, litros: 186, grupo: 'anterior', estado: 'cerrada', supervisor: MIAS, cerradaA: '07:48' },
  { id: 7, equipo: 'EX-002', tipo: 'Excavadora', operador: 'Rubén Carrasco', inicial: 6094.1, final: 6105.0, litros: 164, grupo: 'anterior', estado: 'cerrada', supervisor: MIAS, cerradaA: '07:51' },
  { id: 8, equipo: 'CM-015', tipo: 'Camión', operador: 'Mauricio Olivares', inicial: 21319.2, final: 21330.4, litros: 95, grupo: 'anterior', estado: 'cerrada', supervisor: OTRO_SUPERVISOR, cerradaA: '07:55' },
];

const fmt = (n: number | undefined, dec = 1) =>
  n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const aNumero = (s: string): number | null => {
  if (!s.trim()) return null;
  const v = Number.parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(v) ? null : v;
};

type EstadoReporte = 'sin-enviar' | 'enviado';

export function RegistroEquipoView() {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const { data: equipos = [] } = useEquipment();

  // El turno sale del reloj, no de un valor escrito en la pantalla: a las 20:00
  // cambia solo, aunque la pestaña lleve horas abierta.
  const ahora = useAhora();
  const ctx = useMemo(() => contextoTurno(ahora), [ahora]);
  const anterior = useMemo(() => turnoAnterior(ctx.turno, ctx.fecha), [ctx]);

  const { user, role } = useCurrentUser();
  const supervisor = user?.name?.trim() || user?.email || 'Sin identificar';
  /** El administrador ve el turno completo; un supervisor, solo lo suyo. */
  const veTodo = role === ROLES.ADMIN;

  const [tarjetas, setTarjetas] = useState(TARJETAS_EJEMPLO);
  const [cerrandoId, setCerrandoId] = useState<number | null>(null);
  const [verReporte, setVerReporte] = useState(false);
  const [verCerradas, setVerCerradas] = useState(false);
  const [reporte, setReporte] = useState<EstadoReporte>('sin-enviar');
  const [reporteA, setReporteA] = useState<string | null>(null);

  const esMia = (t: TarjetaTurno) => t.supervisor === MIAS || t.supervisor === supervisor;
  /**
   * R4: el supervisor trabaja sobre sus tarjetas abiertas. Las de otros
   * supervisores no le sirven —no puede cerrarlas— y le agrandan la lista
   * justo cuando está apurado cerrando turno.
   */
  const visibles = useMemo(
    () => (veTodo ? tarjetas : tarjetas.filter(esMia)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tarjetas, veTodo, supervisor],
  );

  const abiertas = visibles.filter((t) => t.estado === 'curso');
  const cerradas = visibles.filter((t) => t.estado === 'cerrada');
  const abiertasActual = abiertas.filter((t) => t.grupo === 'actual');
  const abiertasAnterior = abiertas.filter((t) => t.grupo === 'anterior');
  /** Las del turno en curso: son las que entran en el reporte de salida. */
  const enCurso = abiertasActual;

  /**
   * R1: solo equipos operativos. Los que están en taller o fuera de servicio no
   * aparecen — y tampoco los que ya tienen una tarjeta abierta en este turno,
   * porque un equipo no sale dos veces a la vez.
   */
  const disponibles = useMemo(() => {
    const ocupados = new Set(enCurso.map((t) => t.equipo));
    return equipos.filter((e) => e.status === 'OPERATIONAL' && !ocupados.has(e.internalCode));
  }, [equipos, enCurso]);

  const enTaller = equipos.filter((e) => e.status !== 'OPERATIONAL');

  const [apertura, setApertura] = useState({ equipoId: '', operador: OPERADORES[5], horometro: '' });
  const equipoElegido = disponibles.find((e) => e.id === apertura.equipoId) ?? disponibles[0];

  const [cierre, setCierre] = useState({ final: '', litros: '', observaciones: '' });

  /**
   * Foto del surtidor, OCR y subida: se toma entero del flujo que ya construyó
   * Flota (`usePhotoCaptureFlow` + `FotoRespaldoField`, PRs #21 a #23). No se
   * rehace nada acá.
   *
   * Lo que ese flujo aporta y esta maqueta antes simulaba:
   * - la foto se sube a **R2 privado** y devuelve una clave de almacenamiento,
   *   no una URL pública inventada;
   * - un OCR local lee los litros del display y **prellena el campo**, que
   *   sigue siendo editable — el supervisor confirma en vez de tipear;
   * - la fecha de captura sale del EXIF, así que la pantalla puede avisar si
   *   la foto no es de ahora.
   *
   * La foto sigue siendo obligatoria para cerrar: es el respaldo de la carga
   * y el cliente la pidió explícitamente.
   */
  const foto = usePhotoCaptureFlow((litros) =>
    setCierre((c) => ({ ...c, litros: fmt(litros) })),
  );

  const cerrando = tarjetas.find((t) => t.id === cerrandoId) ?? null;
  const finalNum = aNumero(cierre.final);
  const horasMaquina = cerrando && finalNum != null ? finalNum - cerrando.inicial : null;
  const finalInvalido = horasMaquina != null && horasMaquina < 0;

  const agregarEquipo = () => {
    if (!equipoElegido) return;
    setTarjetas((t) => [
      {
        id: Math.max(0, ...t.map((x) => x.id)) + 1,
        equipo: equipoElegido.internalCode,
        tipo: equipoElegido.type,
        operador: apertura.operador,
        inicial: aNumero(apertura.horometro) ?? equipoElegido.currentHourmeter ?? 0,
        grupo: 'actual',
        estado: 'curso',
        supervisor,
      },
      ...t,
    ]);
    setApertura((a) => ({ ...a, equipoId: '', horometro: '' }));
  };

  const abrirCierre = (id: number) => {
    setCerrandoId(id);
    setCierre({ final: '', litros: '', observaciones: '' });
    // La foto es de ESTA tarjeta: arrastrar la anterior mezclaría el respaldo
    // de un equipo con el de otro.
    foto.resetPhoto();
  };

  const confirmarCierre = async () => {
    if (!cerrando || finalNum == null || finalInvalido || !foto.file) return;

    // La foto se sube a R2 y lo que queda guardado es su clave, no un enlace
    // público. Si la subida falla, `upload` avisa y no se cierra la tarjeta.
    const storageKey = await foto.upload(foto.file);
    if (!storageKey) return;

    setTarjetas((ts) =>
      ts.map((t) =>
        t.id === cerrando.id
          ? {
              ...t,
              estado: 'cerrada',
              final: finalNum,
              litros: aNumero(cierre.litros) ?? 0,
              fotoKey: storageKey,
              cerradaA: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
            }
          : t,
      ),
    );
    setCerrandoId(null);
  };

  // --- Apertura -------------------------------------------------------------

  const formApertura = (
    <Card>
      <CardHead titulo="Abrir equipo" bajada="Se agrega a la lista como tarjeta «En curso»." />
      {disponibles.length === 0 ? (
        <Hint>Todos los equipos operativos ya tienen una tarjeta abierta en este turno.</Hint>
      ) : (
        <Form>
          <Campo
            label="Equipo"
            hint={
              enTaller.length > 0
                ? `Solo equipos operativos. ${enTaller.length === 1 ? `${enTaller[0].internalCode} no aparece porque no está operativo.` : `${enTaller.length} equipos no aparecen porque no están operativos.`}`
                : 'Solo equipos operativos.'
            }
          >
            <Select
              value={equipoElegido?.id ?? ''}
              onChange={(e) => {
                const eq = disponibles.find((x) => x.id === e.target.value);
                setApertura((a) => ({
                  ...a,
                  equipoId: e.target.value,
                  horometro: eq?.currentHourmeter != null ? fmt(eq.currentHourmeter) : '',
                }));
              }}
            >
              {disponibles.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.internalCode} · {e.type}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Operador">
            <Select value={apertura.operador} onChange={(e) => setApertura((a) => ({ ...a, operador: e.target.value }))}>
              {OPERADORES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          </Campo>

          <Campo
            label="Horómetro inicial"
            unidad="h"
            hint={
              equipoElegido?.currentHourmeter != null ? (
                <>
                  Último registrado: <b className="tabular">{fmt(equipoElegido.currentHourmeter)} h</b>
                </>
              ) : (
                'Sin lectura previa para este equipo.'
              )
            }
          >
            <Input
              numerico
              value={apertura.horometro}
              placeholder={equipoElegido?.currentHourmeter != null ? fmt(equipoElegido.currentHourmeter) : '0'}
              onChange={(e) => setApertura((a) => ({ ...a, horometro: e.target.value }))}
            />
          </Campo>

          {/* Turno, fecha y supervisor ya no van acá abajo como tres renglones
              «automáticos»: son la cabecera de la pantalla. Lo que queda es el
              recordatorio de a qué turno se está agregando, porque el
              formulario puede quedar a media pantalla del encabezado. */}
          <Hint>
            Se agrega al turno <b>{ctx.turno}</b> del <b>{ctx.fechaCorta}</b>, a nombre de{' '}
            <b>{supervisor}</b>.
          </Hint>

          <Boton ancho onClick={agregarEquipo}>
            Agregar equipo <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
        </Form>
      )}
    </Card>
  );

  // --- Reporte de salida ----------------------------------------------------

  const panelReporte = (
    <div
      className={`flex flex-col gap-3 rounded-3xl p-[18px] ${
        reporte === 'enviado'
          ? 'border-[1.5px] border-[#b6e2c5] bg-[var(--success-soft)] text-[var(--success-soft-foreground)]'
          : 'text-white'
      }`}
      style={reporte === 'enviado' ? undefined : { background: 'var(--terreno-head)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11.5px] font-bold tracking-[0.08em] uppercase ${
            reporte === 'enviado' ? '' : 'text-white/70'
          }`}
        >
          Reporte de salida
        </span>
        {reporte === 'enviado' ? <Chip tono="success">Enviado</Chip> : <Chip tono="danger">Sin enviar</Chip>}
      </div>
      <p className={`m-0 text-sm leading-snug ${reporte === 'enviado' ? '' : 'text-white/85'}`}>
        {reporte === 'enviado' ? (
          <>
            Enviado a las <b className="tabular">{reporteA}</b> con <b>{enCurso.length} equipos</b>. Lo recibieron el
            administrador y Sergio Torres.
          </>
        ) : (
          <>
            <b className="text-white">{enCurso.length} equipos</b> salieron en este turno y la administración todavía no
            lo sabe.
          </>
        )}
      </p>
      {reporte === 'sin-enviar' ? (
        <>
          <Boton variante="acento" ancho className="min-h-[60px] !rounded-[18px] !text-[17px] shadow-[0_0_0_4px_rgba(29,78,216,.35)]" onClick={() => setVerReporte(true)}>
            Enviar reporte de salida <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
          <p className="m-0 text-[12.5px] text-white/85">
            Aviso en el sistema y correo con el PDF al administrador y a Sergio Torres.
          </p>
        </>
      ) : (
        <Boton variante="contorno" ancho className="!min-h-10 !text-[13.5px]" onClick={() => setVerReporte(true)}>
          Ver reporte
        </Boton>
      )}
    </div>
  );

  /** En teléfono y tablet el reporte no cabe en la columna: va como barra fija. */
  const barraReporte =
    reporte === 'sin-enviar' ? (
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-black px-4 py-3 text-white" style={{ background: 'var(--terreno-head)' }}>
        <div className="flex items-center gap-2 text-[12.5px] text-white/80">
          <i className="h-2 w-2 shrink-0 rounded-full bg-[#ff6b5a]" />
          <span>
            <b className="text-white">{enCurso.length} equipos</b> salieron y la administración aún no lo sabe.
          </span>
        </div>
        <Boton variante="acento" ancho className="mt-2 min-h-[60px] !rounded-[18px] !text-[17px]" onClick={() => setVerReporte(true)}>
          Enviar reporte de salida <ArrowRight className="h-[19px] w-[19px]" />
        </Boton>
      </div>
    ) : (
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center gap-2.5 border-t border-[#b6e2c5] bg-[var(--success-soft)] px-4 py-3 text-sm font-semibold text-[var(--success-soft-foreground)]">
        <Check className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1">
          Reporte enviado a las <span className="tabular">{reporteA}</span> · {enCurso.length} equipos
        </span>
        <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => setVerReporte(true)}>
          Ver
        </Boton>
      </div>
    );

  // --- Historial ------------------------------------------------------------

  const tarjeta = (t: TarjetaTurno) => {
    const cerrada = t.estado === 'cerrada';
    // El borde izquierdo repite el color del turno: si al scrollear se pasa
    // el separador, la tarjeta sola sigue diciendo de qué turno es.
    const acento = TURNO_ESTILO[t.grupo === 'actual' ? ctx.turno : anterior.turno].acento;
    return (
      <Tarjeta
        key={t.id}
        className={`border-l-4 ${t.arrastrada ? 'outline-2 outline-offset-[3px] outline-dashed outline-[var(--terreno-offline)]' : ''}`}
        style={{ borderLeftColor: acento }}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <div className="tabular text-[19px] font-semibold tracking-[-0.01em]">{t.equipo}</div>
            <div className="text-[13px] text-muted-foreground">{t.tipo}</div>
          </div>
          <Chip tono={cerrada ? 'success' : 'info'}>{cerrada ? 'Cerrada' : 'En curso'}</Chip>
        </div>
        <div className="flex items-center gap-2 font-medium">
          <User className="h-[17px] w-[17px] text-muted-foreground" />
          {t.operador}
        </div>
        <Cifras
          items={[
            { label: 'Inicial', valor: fmt(t.inicial) },
            { label: 'Final', valor: fmt(t.final) },
            { label: 'Horas', valor: cerrada ? fmt(t.final! - t.inicial) : '—', destacado: true },
            { label: 'Litros', valor: t.litros != null ? fmt(t.litros, 0) : '—' },
          ]}
        />
        {cerrada ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--success-soft-foreground)]">
              <Camera className="h-4 w-4" />
              Foto del surtidor
            </span>
            <span>· cerrada {t.cerradaA}</span>
          </div>
        ) : (
          <Boton variante="contorno" ancho onClick={() => abrirCierre(t.id)}>
            Cerrar tarjeta <ArrowRight className="h-[19px] w-[19px]" />
          </Boton>
        )}
        {t.sinSincronizar && (
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
            <Clock className="h-[15px] w-[15px]" />
            Guardada en el equipo · falta sincronizar
          </div>
        )}
        {t.arrastrada && (
          <Hint>
            Quedó en curso al terminar el turno anterior. Falta definir con el cliente si sigue abierta, se cierra sola
            o la cierra el administrador.
          </Hint>
        )}
      </Tarjeta>
    );
  };

  const filas = (ts: TarjetaTurno[]) =>
    ts.map((t) => {
      const cerrada = t.estado === 'cerrada';
      return (
        <tr key={t.id} className={t.arrastrada ? 'bg-[#fffaf0]' : ''}>
          <td className={TD}>
            <b className="tabular block text-[15px] font-semibold">{t.equipo}</b>
            <span className="text-[12.5px] text-muted-foreground">{t.tipo}</span>
          </td>
          <td className={TD}>
            {t.operador}
            {t.sinSincronizar && (
              <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-soft-foreground)]">
                <Clock className="h-[15px] w-[15px]" />
                Sin sincronizar
              </div>
            )}
          </td>
          <td className={`${TD} tabular text-right`}>{fmt(t.inicial)}</td>
          <td className={`${TD} tabular text-right`}>{fmt(t.final)}</td>
          <td className={`${TD} tabular text-right font-semibold`}>{cerrada ? fmt(t.final! - t.inicial) : '—'}</td>
          <td className={`${TD} tabular text-right`}>{t.litros != null ? fmt(t.litros, 0) : '—'}</td>
          <td className={TD}>
            {cerrada ? <Camera className="h-4 w-4 text-[var(--success-soft-foreground)]" /> : <span className="text-[#9aa2ad]">—</span>}
          </td>
          <td className={TD}>
            <Chip tono={cerrada ? 'success' : 'info'}>{cerrada ? 'Cerrada' : 'En curso'}</Chip>
          </td>
          <td className={`${TD} text-right`}>
            {!cerrada && (
              <Boton variante="contorno" className="!min-h-10 !text-[13.5px]" onClick={() => abrirCierre(t.id)}>
                Cerrar
              </Boton>
            )}
          </td>
        </tr>
      );
    });

  const encabezados = (
    <thead>
      <tr>
        {/* «Horóm. inicial / final» eran los títulos más anchos de la tabla y
            forzaban el scroll. La sección ya habla de horómetros: el contexto
            lo da el encabezado del grupo, no cada columna. */}
        <th className={TH}>Equipo</th>
        <th className={TH}>Operador</th>
        <th className={`${TH} text-right`}>Inicial</th>
        <th className={`${TH} text-right`}>Final</th>
        <th className={`${TH} text-right`}>Horas</th>
        <th className={`${TH} text-right`}>Litros</th>
        <th className={TH}>Foto</th>
        <th className={TH}>Estado</th>
        <th className={TH} />
      </tr>
    </thead>
  );

  const fechaAnterior = fechaCorta(anterior.fecha);

  /** «Luis Contreras · Turno DIURNO mié 24/09» — a qué turno pertenece la
   *  tarjeta que se está cerrando, que puede no ser el turno en curso. */
  const bajadaCierre = cerrando
    ? `${cerrando.operador} · Turno ${
        cerrando.grupo === 'actual'
          ? `${ctx.turno} ${ctx.fechaCorta}`
          : `${anterior.turno} ${fechaAnterior}`
      }`
    : '';
  const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;

  /**
   * Un bloque de turno: separador + tarjetas (o tabla en escritorio). Los dos
   * turnos se dibujan igual, así que la diferencia que ve el supervisor es
   * solo el color y el icono — no dos diseños distintos que haya que aprender.
   */
  const bloque = (turno: Turno, fecha: string, ts: TarjetaTurno[], vacio: string) =>
    esEscritorio ? (
      <Tabla
        key={`${turno}-${fecha}`}
        turno={turno}
        titulo={`TURNO ${turno} · ${fecha}`}
        detalle={ts.length ? plural(ts.length, 'tarjeta', 'tarjetas') : undefined}
      >
        {encabezados}
        <tbody>
          {ts.length ? (
            filas(ts)
          ) : (
            <tr>
              <td className={`${TD} text-muted-foreground`} colSpan={9}>
                {vacio}
              </td>
            </tr>
          )}
        </tbody>
      </Tabla>
    ) : (
      <div key={`${turno}-${fecha}`}>
        <SeparadorTurno
          turno={turno}
          fecha={fecha}
          detalle={ts.length ? plural(ts.length, 'tarjeta', 'tarjetas') : undefined}
        />
        {ts.length ? (
          <div className="mt-3 flex flex-col gap-3">{ts.map(tarjeta)}</div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {vacio}
          </p>
        )}
      </div>
    );

  /**
   * R4: la lista es la de tarjetas ABIERTAS. Las cerradas ya no piden nada al
   * supervisor y son las que más crecen —al final de un turno son todas—, así
   * que viven detrás de un botón en vez de empujar hacia abajo lo único sobre
   * lo que todavía hay que actuar.
   */
  const historial = (
    <>
      {bloque(
        ctx.turno,
        ctx.fechaCorta,
        abiertasActual,
        veTodo ? 'Sin tarjetas abiertas en este turno.' : 'No tenés tarjetas abiertas en este turno.',
      )}

      {abiertasAnterior.length > 0 &&
        bloque(anterior.turno, fechaAnterior, abiertasAnterior, '')}

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setVerCerradas((v) => !v)}
          aria-expanded={verCerradas}
          className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 text-left"
        >
          <span className="text-sm font-bold">Historial de cerradas</span>
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {plural(cerradas.length, 'tarjeta', 'tarjetas')}
            <ChevronDown
              className={`h-[18px] w-[18px] transition-transform ${verCerradas ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </span>
        </button>

        {verCerradas && (
          <div className="mt-3 flex flex-col gap-4">
            {cerradas.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Todavía no cerraste ninguna tarjeta.
              </p>
            ) : (
              [
                { turno: ctx.turno, fecha: ctx.fechaCorta, grupo: 'actual' as const },
                { turno: anterior.turno, fecha: fechaAnterior, grupo: 'anterior' as const },
              ]
                .map((g) => ({ ...g, ts: cerradas.filter((t) => t.grupo === g.grupo) }))
                .filter((g) => g.ts.length > 0)
                .map((g) => bloque(g.turno, g.fecha, g.ts, ''))
            )}
          </div>
        )}
      </div>
    </>
  );

  // --- Cierre de tarjeta ----------------------------------------------------

  const formularioCierre = cerrando && (
    <>
      <div className="flex items-center justify-between rounded-2xl bg-[#f3f4f6] px-3.5 py-3">
        <Label>Horómetro inicial</Label>
        <b className="tabular text-[17px] font-medium">{fmt(cerrando.inicial)} h</b>
      </div>

      <Campo label="Horómetro final" requerido unidad="h">
        <Input numerico value={cierre.final} onChange={(e) => setCierre((c) => ({ ...c, final: e.target.value }))} />
      </Campo>
      {finalInvalido && (
        <span className="text-[13px] font-semibold text-[var(--danger)]">
          No puede ser menor que el horómetro inicial.
        </span>
      )}

      <Calculado
        label="Horas máquina"
        nota={
          <span className="flex items-center gap-1.5">
            <Lock className="h-[13px] w-[13px]" />
            Calculado · no editable
          </span>
        }
        valor={horasMaquina != null && horasMaquina >= 0 ? `${fmt(horasMaquina)} h` : '—'}
      />

      <Campo label="Combustible cargado" requerido unidad="L" hint="Cero si no cargó en el turno.">
        <Input numerico value={cierre.litros} onChange={(e) => setCierre((c) => ({ ...c, litros: e.target.value }))} />
      </Campo>

      {/*
        Foto, OCR y subida vienen enteros de Flota: el mismo bloque que usan
        la entrada, la salida y la carga de combustible. La foto del
        totalizador es el respaldo de la carga y el cliente la puso como
        obligatoria; sin ella el botón no se habilita, y la pantalla dice por
        qué en vez de dejar un botón apagado sin explicación.
      */}
      <FotoRespaldoField
        file={foto.file}
        isReadingPhoto={foto.isReadingPhoto}
        isUploadingPhoto={foto.isUploadingPhoto}
        captureDate={foto.captureDate}
        onSelect={foto.handleSelectPhoto}
        onClear={foto.handleClearPhoto}
        title="Foto del surtidor"
        subtitle="Debe verse el totalizador. Los litros se leen de la foto y quedan editables."
        staleQuestion="¿Es la carga de este turno?"
      />

      <Campo label="Observaciones">
        <Textarea
          rows={3}
          placeholder="Novedades del equipo durante el turno"
          value={cierre.observaciones}
          onChange={(e) => setCierre((c) => ({ ...c, observaciones: e.target.value }))}
        />
      </Campo>

      <Boton
        ancho
        onClick={confirmarCierre}
        disabled={
          !foto.file || foto.isReadingPhoto || foto.isUploadingPhoto || finalNum == null || finalInvalido
        }
      >
        {foto.isUploadingPhoto ? 'Subiendo la foto…' : 'Cerrar tarjeta'}
        <ArrowRight className="h-[19px] w-[19px]" />
      </Boton>
      {!foto.file && (
        <p className="m-0 text-center text-[12.5px] text-muted-foreground">
          Falta la foto del surtidor para cerrar.
        </p>
      )}
    </>
  );

  return (
    <>
      {/* Primero el turno, después el título: lo que el supervisor necesita
          confirmar de un vistazo es EN QUÉ turno está registrando, no en qué
          pantalla. Ver `CabeceraTurno`. */}
      <CabeceraTurno
        turno={ctx.turno}
        fecha={ctx.fechaCorta}
        hora={ctx.fechaHora}
        supervisor={supervisor}
        extra={
          <span
            className="inline-flex min-h-[32px] items-center rounded-full px-3"
            style={{ background: 'rgba(255,255,255,.22)' }}
          >
            Faena Patillo
          </span>
        }
      />

      <VistaHead
        titulo="Registro de equipo"
        contexto={<Chip tono="warning">Maqueta</Chip>}
      />

      <VistaSplit
        formulario={
          <>
            {/* En escritorio el cierre reemplaza al formulario de apertura en la
                misma columna; en teléfono y tablet se abre como hoja inferior. */}
            {esEscritorio && cerrando ? (
              <Card>
                <CardHead
                  titulo={
                    <>
                      <span className="tabular">{cerrando.equipo}</span> · {cerrando.tipo}
                    </>
                  }
                  bajada={bajadaCierre}
                  extra={
                    <button
                      type="button"
                      onClick={() => setCerrandoId(null)}
                      aria-label="Cancelar"
                      className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#eef0f2]"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  }
                />
                <Form>{formularioCierre}</Form>
              </Card>
            ) : (
              formApertura
            )}
            {esEscritorio && panelReporte}
          </>
        }
        historial={historial}
      />

      {!esEscritorio && barraReporte}

      {!esEscritorio && cerrando && (
        <Hoja
          eyebrow="Cerrar tarjeta"
          titulo={`${cerrando.equipo} · ${cerrando.tipo}`}
          bajada={bajadaCierre}
          onCerrar={() => setCerrandoId(null)}
        >
          <Form>{formularioCierre}</Form>
        </Hoja>
      )}

      {verReporte && (
        <Hoja
          eyebrow="Reporte de salida de turno"
          titulo={reporte === 'enviado' ? 'Reporte emitido' : 'Revisá y enviá'}
          bajada="Así lo recibe la administración, también en PDF."
          onCerrar={() => setVerReporte(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between gap-2.5 px-3.5 py-3 text-white" style={{ background: 'var(--terreno-head)' }}>
              <div>
                <b className="block text-sm">Transportes Optimiza SPA</b>
                <span className="text-[11.5px] tracking-[0.1em] text-white/65 uppercase">
                  Reporte de salida de turno
                </span>
              </div>
              <span className="tabular text-xs">PDF</span>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border px-3.5 py-3 text-[13px]">
              {[
                ['Fecha', ctx.fecha.toLocaleDateString('es-CL')],
                ['Turno', ctx.etiqueta],
                ['Emitido', reporteA ?? '08:41'],
                ['Supervisor', supervisor],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{k}</dt>
                  <dd className="mt-px font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className={TH}>Equipo</th>
                    <th className={TH}>Operador</th>
                    <th className={`${TH} text-right`}>Horóm. inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {enCurso.map((t) => (
                    <tr key={t.id}>
                      <td className={TD}>
                        <b className="tabular block font-semibold">{t.equipo}</b>
                        <span className="text-[12.5px] text-muted-foreground">{t.tipo}</span>
                      </td>
                      <td className={TD}>{t.operador}</td>
                      <td className={`${TD} tabular text-right`}>{fmt(t.inicial)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-[#f5f6f8] px-3 py-2.5 text-[13px] text-muted-foreground">
            <Mail className="h-[18px] w-[18px] shrink-0 text-foreground" />
            <span>
              <b className="text-foreground">Destinatarios:</b> administrador y Sergio Torres. Aviso dentro del sistema
              y correo con el PDF adjunto. Nunca a los clientes finales de Optimiza.
            </span>
          </div>

          {reporte === 'sin-enviar' && (
            <Boton
              variante="acento"
              ancho
              className="min-h-[60px] !rounded-[18px] !text-[17px]"
              onClick={() => {
                setReporte('enviado');
                setReporteA(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
                setVerReporte(false);
              }}
            >
              Enviar ahora <ArrowRight className="h-[19px] w-[19px]" />
            </Boton>
          )}
        </Hoja>
      )}
    </>
  );
}
